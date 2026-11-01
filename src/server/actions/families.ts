'use server'

import { z } from 'zod'
import { defineAction } from '@/server/lib/boundary'
import { RELATIONSHIPS } from '@/server/domain/enums'
import {
  addGuardianByEmail,
  createHousehold,
  ensureHousehold,
  saveStudent,
  setHouseholdNotes,
  setStudentLevels,
  setStudentStatus,
  studentOptions,
  updateHousehold,
} from '@/server/services/families'
import {
  householdInput,
  id,
  levelsInput,
  studentInput,
  studentStatusInput,
} from '@/server/validators/families'

/** First visit to the portal: make sure the family exists. */
export const ensureHouseholdAction = defineAction(z.object({}), () => ensureHousehold())

export const saveHouseholdAction = defineAction(
  z.object({ id: id.nullable(), data: householdInput }),
  ({ id: hid, data }) => (hid ? updateHousehold(hid, data) : createHousehold(data)),
)

export const setHouseholdNotesAction = defineAction(
  z.object({ id, notes: z.string().max(2000) }),
  ({ id: hid, notes }) => setHouseholdNotes(hid, notes),
)

export const addGuardianAction = defineAction(
  z.object({
    householdId: id,
    email: z.email('Enter the parent’s email').transform((v) => v.toLowerCase()),
    relationship: z.enum(RELATIONSHIPS).default('guardian'),
  }),
  ({ householdId, email, relationship }) => addGuardianByEmail(householdId, email, relationship),
)

export const saveStudentAction = defineAction(
  z.object({ id: id.nullable(), householdId: id.optional(), data: studentInput }),
  ({ id: sid, householdId, data }) => saveStudent(sid, data, householdId),
)

export const setStudentStatusAction = defineAction(studentStatusInput, ({ id: sid, status }) =>
  setStudentStatus(sid, status),
)

export const setStudentLevelsAction = defineAction(
  z.object({ id, levels: levelsInput }),
  ({ id: sid, levels }) => setStudentLevels(sid, levels),
)

export const studentOptionsAction = defineAction(
  z.object({ q: z.string().max(60).default('') }),
  ({ q }) => studentOptions(q),
)
