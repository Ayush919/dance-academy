import { Schema, model, type InferSchemaType } from 'mongoose'
import { baseSchemaOptions, defineModel } from '@/server/db/model'
import { tenantPlugin, type Tenant } from '@/server/db/plugins/tenant'
import { GENDERS, LEVELS, STUDENT_STATUSES } from '@/server/domain/enums'
import { LOCAL_DATE } from './shared'

const studentSchema = new Schema(
  {
    householdId: { type: Schema.Types.ObjectId, ref: 'Household', required: true },
    /** Own login: teens 13+ (view-only) and adults. */
    userId: { type: String, default: null },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    /** Calendar date, "YYYY-MM-DD". A string, so no timezone can shift a birthday. */
    dob: { type: String, required: true, match: LOCAL_DATE },
    gender: { type: String, enum: GENDERS, default: null },
    photo: { url: { type: String, default: null } },
    levels: {
      type: [
        new Schema(
          { style: { type: String, required: true }, level: { type: String, enum: LEVELS } },
          { _id: false },
        ),
      ],
      default: [],
    },
    /**
     * Restricted. `select: false` means no query returns it unless the service asks for it after
     * checking `students.medical.read`, so a forgotten projection can't leak it.
     */
    medicalNotes: { type: String, default: '', maxlength: 2000, select: false },
    emergencyContacts: {
      type: [
        new Schema(
          {
            name: { type: String, required: true },
            relationship: { type: String, default: '' },
            phone: { type: String, required: true },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    status: { type: String, enum: STUDENT_STATUSES, default: 'active' },
    /** True when an adult registered themselves. */
    isSelf: { type: Boolean, default: false },
    /** Branches where the student is or was enrolled. Empty until the first enrolment. */
    branchIds: { type: [Schema.Types.ObjectId], ref: 'Branch', default: [] },
    deletedAt: { type: Date, default: null },
  },
  baseSchemaOptions,
)

studentSchema.plugin(tenantPlugin)
studentSchema.index({ academyId: 1, householdId: 1 })
studentSchema.index({ academyId: 1, branchIds: 1, status: 1 })
studentSchema.index({ academyId: 1, name: 1 })
studentSchema.index({ academyId: 1, userId: 1 }, { sparse: true })

export type Student = InferSchemaType<typeof studentSchema> & Tenant
export const StudentModel = defineModel('StudentProfile', () =>
  model<Student>('StudentProfile', studentSchema),
)
