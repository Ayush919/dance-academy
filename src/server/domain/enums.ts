/** Enumerations shared by models, validators and UI. No imports: safe for client bundles. */

export const LEVELS = ['beginner', 'intermediate', 'advanced', 'all'] as const
export type Level = (typeof LEVELS)[number]
export const LEVEL_LABELS: Record<Level, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  all: 'All levels',
}

export const MODES = ['offline', 'online', 'hybrid'] as const
export type Mode = (typeof MODES)[number]
export const MODE_LABELS: Record<Mode, string> = {
  offline: 'In studio',
  online: 'Online',
  hybrid: 'Hybrid',
}

export const PUBLISH_STATUSES = ['draft', 'published', 'archived'] as const
export type PublishStatus = (typeof PUBLISH_STATUSES)[number]

export const FEE_PLAN_TYPES = ['monthly', 'term', 'course', 'class_pack', 'drop_in'] as const
export type FeePlanType = (typeof FEE_PLAN_TYPES)[number]
export const FEE_PLAN_TYPE_LABELS: Record<FeePlanType, string> = {
  monthly: 'Monthly',
  term: 'Term',
  course: 'Full course',
  class_pack: 'Class pack',
  drop_in: 'Drop-in',
}

export const PRORATION_RULES = ['daily', 'half_month', 'none'] as const
export type ProrationRule = (typeof PRORATION_RULES)[number]
export const PRORATION_LABELS: Record<ProrationRule, string> = {
  daily: 'By day',
  half_month: 'Half month after the 15th',
  none: 'No proration',
}

export const BATCH_STATUSES = ['draft', 'active', 'paused', 'completed', 'cancelled'] as const
export type BatchStatus = (typeof BATCH_STATUSES)[number]
/** Batches in these states hold their room and instructors. */
export const SCHEDULING_STATUSES: readonly BatchStatus[] = ['active', 'paused']

export const BLOCK_REASONS = ['maintenance', 'private_hire', 'event', 'leave', 'other'] as const
export type BlockReason = (typeof BLOCK_REASONS)[number]
export const BLOCK_REASON_LABELS: Record<BlockReason, string> = {
  maintenance: 'Maintenance',
  private_hire: 'Private hire',
  event: 'Event',
  leave: 'Instructor leave',
  other: 'Other',
}

export const SESSION_STATUSES = ['scheduled', 'cancelled', 'completed'] as const

export const EVENT_TYPES = [
  'workshop',
  'masterclass',
  'competition',
  'showcase',
  'online',
  'special',
] as const
export type EventType = (typeof EVENT_TYPES)[number]
export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  workshop: 'Workshop',
  masterclass: 'Masterclass',
  competition: 'Competition',
  showcase: 'Showcase',
  online: 'Online',
  special: 'Special session',
}

export const GALLERY_CATEGORIES = [
  'performances',
  'workshops',
  'events',
  'students',
  'behind-the-scenes',
] as const
export type GalleryCategory = (typeof GALLERY_CATEGORIES)[number]
export const GALLERY_CATEGORY_LABELS: Record<GalleryCategory, string> = {
  performances: 'Performances',
  workshops: 'Workshops',
  events: 'Events',
  students: 'Students',
  'behind-the-scenes': 'Behind the scenes',
}

export const INQUIRY_TOPICS = [
  'general',
  'classes',
  'trial',
  'events',
  'franchise',
  'other',
] as const
export type InquiryTopic = (typeof INQUIRY_TOPICS)[number]
export const INQUIRY_TOPIC_LABELS: Record<InquiryTopic, string> = {
  general: 'General question',
  classes: 'Classes & fees',
  trial: 'Book a trial class',
  events: 'Workshops & events',
  franchise: 'Franchise / partnership',
  other: 'Something else',
}

// ── Families, consent, enrolment (Phase 6) ──────────────────────────────

export const GENDERS = ['female', 'male', 'non_binary', 'prefer_not_to_say'] as const
export type Gender = (typeof GENDERS)[number]
export const GENDER_LABELS: Record<Gender, string> = {
  female: 'Female',
  male: 'Male',
  non_binary: 'Non-binary',
  prefer_not_to_say: 'Prefer not to say',
}

export const RELATIONSHIPS = [
  'mother',
  'father',
  'guardian',
  'grandparent',
  'self',
  'other',
] as const
export type Relationship = (typeof RELATIONSHIPS)[number]
export const RELATIONSHIP_LABELS: Record<Relationship, string> = {
  mother: 'Mother',
  father: 'Father',
  guardian: 'Guardian',
  grandparent: 'Grandparent',
  self: 'Myself',
  other: 'Other',
}

export const CONTACT_CHANNELS = ['email', 'whatsapp', 'sms'] as const
export type ContactChannel = (typeof CONTACT_CHANNELS)[number]
export const CONTACT_CHANNEL_LABELS: Record<ContactChannel, string> = {
  email: 'Email',
  whatsapp: 'WhatsApp',
  sms: 'SMS',
}

export const STUDENT_STATUSES = ['active', 'paused', 'alumni', 'suspended'] as const
export type StudentStatus = (typeof STUDENT_STATUSES)[number]
export const STUDENT_STATUS_LABELS: Record<StudentStatus, string> = {
  active: 'Active',
  paused: 'Paused',
  alumni: 'Alumni',
  suspended: 'Suspended',
}

export const CONSENT_TYPES = [
  'liability_waiver',
  'medical_authorization',
  'media_release',
  'terms',
  'code_of_conduct',
  'custom',
] as const
export type ConsentType = (typeof CONSENT_TYPES)[number]
export const CONSENT_TYPE_LABELS: Record<ConsentType, string> = {
  liability_waiver: 'Liability waiver',
  medical_authorization: 'Medical authorisation',
  media_release: 'Photo and video release',
  terms: 'Terms and conditions',
  code_of_conduct: 'Code of conduct',
  custom: 'Other',
}

export const CONSENT_REQUIRED_FOR = ['enrolment', 'events', 'trials'] as const
export type ConsentRequiredFor = (typeof CONSENT_REQUIRED_FOR)[number]
export const CONSENT_REQUIRED_LABELS: Record<ConsentRequiredFor, string> = {
  enrolment: 'Enrolment',
  events: 'Events',
  trials: 'Trial classes',
}

/** Where a media release lets the academy show a student. */
export const MEDIA_SCOPES = ['website', 'social', 'print', 'video'] as const
export type MediaScope = (typeof MEDIA_SCOPES)[number]
export const MEDIA_SCOPE_LABELS: Record<MediaScope, string> = {
  website: 'Our website',
  social: 'Social media',
  print: 'Printed material',
  video: 'Promotional videos',
}

export const DOCUMENT_TYPES = [
  'id_proof',
  'birth_certificate',
  'medical_certificate',
  'photo_id',
  'other',
] as const
export type DocumentType = (typeof DOCUMENT_TYPES)[number]
export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  id_proof: 'ID proof',
  birth_certificate: 'Birth certificate',
  medical_certificate: 'Medical certificate',
  photo_id: 'Photo ID',
  other: 'Other',
}

export const ENROLLMENT_STATUSES = [
  'pending',
  'active',
  'paused',
  'completed',
  'cancelled',
  'transferred',
] as const
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number]
export const ENROLLMENT_STATUS_LABELS: Record<EnrollmentStatus, string> = {
  pending: 'Pending',
  active: 'Active',
  paused: 'Paused',
  completed: 'Completed',
  cancelled: 'Cancelled',
  transferred: 'Transferred',
}
/** Statuses that occupy a seat in the batch. */
export const SEAT_STATUSES: readonly EnrollmentStatus[] = ['pending', 'active', 'paused']

export const ENROLLMENT_SOURCES = ['web', 'staff', 'trial', 'waitlist', 'transfer'] as const
export type EnrollmentSource = (typeof ENROLLMENT_SOURCES)[number]

export const WAITLIST_STATUSES = [
  'waiting',
  'offered',
  'accepted',
  'declined',
  'expired',
  'removed',
] as const
export type WaitlistStatus = (typeof WAITLIST_STATUSES)[number]
export const WAITLIST_STATUS_LABELS: Record<WaitlistStatus, string> = {
  waiting: 'Waiting',
  offered: 'Seat offered',
  accepted: 'Accepted',
  declined: 'Declined',
  expired: 'Offer expired',
  removed: 'Removed',
}
/** Waitlist entries in these states are "open": one per student per batch. */
export const OPEN_WAITLIST: readonly WaitlistStatus[] = ['waiting', 'offered']

export const SEAT_HOLD_KINDS = ['checkout', 'waitlist_offer'] as const
export type SeatHoldKind = (typeof SEAT_HOLD_KINDS)[number]
