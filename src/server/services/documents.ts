import 'server-only'
import { Types } from 'mongoose'
import { requireContext } from '@/server/context/request-context'
import { DOCUMENT_TYPES, type DocumentType } from '@/server/domain/enums'
import { AppError, notFound } from '@/server/lib/errors'
import { MAX_DOCUMENT_BYTES, sniffDocument } from '@/server/lib/file-sniff'
import { deletePrivate, readPrivate, savePrivate } from '@/server/integrations/private-store'
import { StudentDocumentModel } from '@/server/models/student-document'
import { StudentModel } from '@/server/models/student'
import { recordAudit } from './audit'
import { authorizePerson } from './people-scope'

const toId = (id: string) => new Types.ObjectId(id)
const todayIso = () => new Date().toISOString().slice(0, 10)
const MAX_PER_STUDENT = 25
const EXPIRY_WARNING_DAYS = 30

async function loadStudent(studentId: string) {
  const student = await StudentModel.findOne(
    { _id: toId(studentId), deletedAt: null },
    { householdId: 1, branchIds: 1, name: 1 },
  ).lean()
  if (!student) throw notFound('Student')
  return student
}

const refOf = (
  s: { householdId: Types.ObjectId; branchIds: Types.ObjectId[] },
  studentId: string,
) => ({
  householdId: s.householdId.toString(),
  studentId,
  branchIds: s.branchIds.map(String),
})

export type DocumentState = 'valid' | 'expiring' | 'expired'

export interface DocumentRow {
  id: string
  type: DocumentType
  label: string
  mime: string
  bytes: number
  originalName: string
  uploadedByName: string
  uploadedAt: string
  verified: boolean
  verifiedByName: string | null
  verifiedAt: string | null
  expiresOn: string | null
  state: DocumentState
  notes: string
}

function stateOf(expiresOn: string | null): DocumentState {
  if (!expiresOn) return 'valid'
  const today = todayIso()
  if (expiresOn < today) return 'expired'
  const soon = new Date(Date.now() + EXPIRY_WARNING_DAYS * 86_400_000).toISOString().slice(0, 10)
  return expiresOn <= soon ? 'expiring' : 'valid'
}

export async function listStudentDocuments(studentId: string): Promise<DocumentRow[]> {
  const student = await loadStudent(studentId)
  authorizePerson('documents.read', refOf(student, studentId))
  const rows = await StudentDocumentModel.find({ studentId: student._id, deletedAt: null })
    .sort({ createdAt: -1 })
    .lean()
  return rows.map((r) => ({
    id: r._id.toString(),
    type: r.type,
    label: r.label ?? '',
    mime: r.mime,
    bytes: r.bytes,
    originalName: r.originalName ?? '',
    uploadedByName: r.uploadedByName ?? '',
    uploadedAt: (r.createdAt as Date).toISOString(),
    verified: !!r.verifiedAt,
    verifiedByName: r.verifiedByName ?? null,
    verifiedAt: r.verifiedAt ? r.verifiedAt.toISOString() : null,
    expiresOn: r.expiresOn ?? null,
    state: stateOf(r.expiresOn ?? null),
    notes: r.notes ?? '',
  }))
}

/** Store a document. The file type is read from its bytes; PDF and photos only, 10 MB at most. */
export async function uploadDocument(
  meta: { studentId: string; type: DocumentType; label: string; expiresOn: string },
  file: { name: string; bytes: Uint8Array },
) {
  const student = await loadStudent(meta.studentId)
  const actor = authorizePerson('documents.manage', refOf(student, meta.studentId))
  if (file.bytes.byteLength === 0) throw new AppError('VALIDATION', 'That file is empty')
  if (file.bytes.byteLength > MAX_DOCUMENT_BYTES)
    throw new AppError('VALIDATION', 'Files can be up to 10 MB')
  const kind = sniffDocument(file.bytes)
  if (!kind) throw new AppError('VALIDATION', 'Upload a PDF, JPEG, PNG, WebP or HEIC file')
  const count = await StudentDocumentModel.countDocuments({
    studentId: student._id,
    deletedAt: null,
  })
  if (count >= MAX_PER_STUDENT)
    throw new AppError('VALIDATION', `Up to ${MAX_PER_STUDENT} documents per student`)

  const stored = await savePrivate(requireContext().academyId, kind.ext, file.bytes, kind.mime)
  try {
    const doc = await StudentDocumentModel.create({
      studentId: student._id,
      householdId: student.householdId,
      type: meta.type,
      label: meta.label,
      provider: stored.provider,
      storageKey: stored.storageKey,
      mime: kind.mime,
      bytes: file.bytes.byteLength,
      originalName: file.name.slice(0, 120),
      uploadedBy: actor.userId,
      uploadedByName: actor.name,
      expiresOn: meta.expiresOn || null,
    })
    await recordAudit({
      action: 'document.upload',
      entity: 'StudentDocument',
      entityId: doc.id,
      meta: { studentId: meta.studentId, type: meta.type },
    })
    return { id: doc.id as string }
  } catch (e) {
    await deletePrivate(stored.provider, stored.storageKey).catch(() => undefined)
    throw e
  }
}

/** The file itself, after the permission check. Every view is audited. */
export async function readDocument(id: string) {
  const doc = await StudentDocumentModel.findOne({ _id: toId(id), deletedAt: null }).lean()
  if (!doc) throw notFound('Document')
  const student = await StudentModel.findOne(
    { _id: doc.studentId },
    { householdId: 1, branchIds: 1 },
  ).lean()
  authorizePerson(
    'documents.read',
    refOf(student ?? { householdId: doc.householdId, branchIds: [] }, doc.studentId.toString()),
  )
  const bytes = await readPrivate(doc.provider, doc.storageKey)
  await recordAudit({
    action: 'document.view',
    entity: 'StudentDocument',
    entityId: id,
    meta: { studentId: doc.studentId.toString() },
  })
  return { bytes, mime: doc.mime, name: doc.originalName || `${doc.type}.pdf` }
}

/** Staff confirm they've checked the document, and can record its expiry date. */
export async function verifyDocument(id: string, input: { expiresOn: string; notes: string }) {
  const doc = await StudentDocumentModel.findOne({ _id: toId(id), deletedAt: null }).lean()
  if (!doc) throw notFound('Document')
  const student = await loadStudent(doc.studentId.toString())
  const actor = authorizePerson('documents.manage', refOf(student, doc.studentId.toString()))
  if (actor.role === 'guardian' || actor.role === 'student')
    throw new AppError('FORBIDDEN', 'The studio verifies documents')
  await StudentDocumentModel.updateOne(
    { _id: doc._id },
    {
      $set: {
        verifiedBy: actor.userId,
        verifiedByName: actor.name,
        verifiedAt: new Date(),
        expiresOn: input.expiresOn || doc.expiresOn || null,
        notes: input.notes.slice(0, 500),
      },
    },
  )
  await recordAudit({ action: 'document.verify', entity: 'StudentDocument', entityId: id })
  return { id }
}

/** Families can remove a document until staff verify it; staff can remove any. */
export async function deleteDocument(id: string) {
  const doc = await StudentDocumentModel.findOne({ _id: toId(id), deletedAt: null }).lean()
  if (!doc) throw notFound('Document')
  const student = await loadStudent(doc.studentId.toString())
  const actor = authorizePerson('documents.manage', refOf(student, doc.studentId.toString()))
  const family = actor.role === 'guardian' || actor.role === 'student'
  if (family && doc.verifiedAt)
    throw new AppError(
      'PRECONDITION_FAILED',
      'The studio has verified this document. Contact them to replace it.',
    )
  await StudentDocumentModel.updateOne({ _id: doc._id }, { $set: { deletedAt: new Date() } })
  await deletePrivate(doc.provider, doc.storageKey).catch(() => undefined)
  await recordAudit({ action: 'document.delete', entity: 'StudentDocument', entityId: id })
  return { id }
}

/** Required document types a student has no valid (uploaded and unexpired) copy of. */
export async function missingDocuments(
  studentId: string,
  required: readonly string[],
): Promise<DocumentType[]> {
  const types = required.filter((t): t is DocumentType =>
    (DOCUMENT_TYPES as readonly string[]).includes(t),
  )
  if (!types.length) return []
  const have = await StudentDocumentModel.find(
    { studentId: toId(studentId), deletedAt: null, type: { $in: types } },
    { type: 1, expiresOn: 1 },
  ).lean()
  const ok = new Set(
    have.filter((d) => stateOf(d.expiresOn ?? null) !== 'expired').map((d) => d.type),
  )
  return types.filter((t) => !ok.has(t))
}
