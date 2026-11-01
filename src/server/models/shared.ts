import { Schema } from 'mongoose'

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

/** Weekly recurring time window in branch-local time. */
export const weeklySlotSchema = new Schema(
  {
    weekday: { type: Number, required: true, min: 0, max: 6 },
    startTime: { type: String, required: true, match: TIME },
    endTime: { type: String, required: true, match: TIME },
  },
  { _id: false },
)

export const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/
