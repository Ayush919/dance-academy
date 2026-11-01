import mongoose from 'mongoose'

/**
 * Register a model once and reuse it across hot reloads.
 * Usage: `defineModel('Room', () => model<Room>('Room', roomSchema))`. The factory keeps the
 * concrete schema type at the call site; passing an untyped Schema to model() makes TypeScript
 * explode Mongoose's generics.
 */
export function defineModel<M>(name: string, create: () => M): M {
  return (mongoose.models[name] as M | undefined) ?? create()
}

/** Schema options shared by every business collection. */
export const baseSchemaOptions = {
  timestamps: true,
  versionKey: false,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
} as const
