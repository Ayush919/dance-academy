# Remo Dance Company — Platform Specification

> **Status:** Final specification, v1.0 · **Date:** 2026-11-01 · Supersedes `docs/PLAN.md`
> **Demo brand:** Remo Dance Company (every brand detail can be replaced from Brand Settings)

A premium public website and a complete business system for a multi-branch dance academy. From one dashboard the academy runs its website, students, parents, programs, instructors, rooms, schedules, enrolments, attendance, fees, marketing and reporting, without a developer.

---

## 0. What changed since the plan

| Area | Change |
|---|---|
| Families | `Household` model added: one billing account, multiple guardians, multiple children. Guardians book, pay and consent for their children. |
| Consent | Versioned consent forms (waiver, medical, policies, media release) with signature records. Gallery and testimonials **cannot publish** a student who lacks media consent. |
| Finance | Rebuilt as an append-only **ledger**: fee plans, invoices, partial payments, allocations, discounts, credit notes, refunds, household credit, and a full transaction history. Issued invoices are never edited. |
| Policies | Configurable cancellation and refund rules (by notice period) for trials, enrolments and events. |
| Rooms | Rooms and facility blocks become first-class. Every time-bound use of a room or instructor is checked for overlap. |
| Documents | Private student documents (ID, medical, birth certificate) with signed, short-lived access and expiry reminders. |
| Data | Data exports, a backup and restore runbook, a data-protection request flow, and an immutable audit log with a viewer. |
| PWA | Installable staff app with **offline attendance** that syncs safely when the signal returns. |
| CMS | Autosave, revision history, restore, scheduled publishing, responsive preview, edit-conflict protection, and one draft/publish mechanism used for pages, navigation, footer, branding, SEO and settings. |
| Logic | Seat holds, waitlist offers with expiry, idempotent payments, ledger reconciliation, timezone rules, a central authorization policy, enforced tenant isolation, and a notification outbox with retries and delivery tracking. |

---

## 1. Users

| Persona | Main jobs |
|---|---|
| **Visitor / parent** | Discover programs, find the right class, book a trial, contact the academy. |
| **Guardian** | Manage children, enrol, pay, sign consent, see attendance and progress. |
| **Adult student** | The same as a guardian, for themselves. |
| **Teen student (optional login)** | View their own schedule, attendance and certificates. Cannot pay or sign consent. |
| **Instructor** | See today's classes, take attendance (even offline), view rosters, set availability. |
| **Receptionist / staff** | Handle leads, trials, walk-ins, record payments, answer inquiries. |
| **Branch manager** | Run one branch: batches, rooms, students, staff, fees, reports. |
| **Academy admin** | Run the academy and website. |
| **Super admin** | Everything, including users, roles, data export and destructive operations. |

---

## 2. Differentiators

1. **Class Finder:** 4 questions (age, experience, goal, branch/time) → matched batches with live seat counts.
2. **True scarcity + waitlist offers:** "3 spots left" is real; when a batch is full the visitor joins a waitlist; freed seats are offered automatically with a deadline.
3. **Family accounts:** one login and one bill for every child, with sibling discounts applied automatically.
4. **Make-up classes:** a missed class can be booked into another batch at the same level, within limits the academy sets.
5. **Offline-first attendance PWA:** one-tap roster or QR check-in that works in a basement studio with no signal.
6. **Fee management without a gateway:** GST-ready invoices, UPI/cash/bank recording, partial payments, ageing, one-click WhatsApp reminders. A gateway plugs in later without schema changes.
7. **Consent-aware media:** the gallery refuses to publish a photo of a child whose guardian has not given media consent.
8. **Verifiable certificates:** PDF with QR to a public verification page students can share.
9. **Section-level visitor analytics:** cookieless, first-party, with region and a visit → program → trial → enrolment funnel.
10. **⌘K command palette** across students, households, leads, batches and invoices.

---

## 3. Technology

| Layer | Choice (current stable major) |
|---|---|
| App | Next.js 16 App Router, React 19, TypeScript `strict` + `noUncheckedIndexedAccess` |
| UI | Tailwind CSS 4, shadcn/ui (Radix primitives), Motion 14, TanStack Table 8, Recharts 3 |
| Forms & validation | React Hook Form 7, Zod 4 (shared client/server schemas) |
| Data | MongoDB Atlas (replica set), Mongoose 9 |
| Auth | Better Auth 1.7 (MongoDB adapter, email + password, verification, reset, sessions in HTTP-only cookies, built-in rate limits) |
| Media | Cloudinary (public assets + `authenticated` private assets for documents) |
| Email | Resend (with webhooks for delivery status) |
| Rich text | Tiptap 3, stored as JSON, rendered through an allow-list |
| PDFs | `@react-pdf/renderer` (invoices, receipts, certificates) |
| Time | `date-fns` 4 + `@date-fns/tz` |
| PWA | Serwist 9 (service worker), `idb` for the offline queue |
| Maps | Google Maps Embed + Places for branch locations |
| Testing | Vitest 5 + `mongodb-memory-server` (replica set) + `fast-check` for billing; Playwright for end-to-end |

Swappable adapters (all with a dev/log mode that needs no credentials): `MediaStore`, `EmailProvider`, `WhatsAppProvider`, `PaymentGateway` (reserved, not built), `RateLimitStore`.

---

## 4. Design system

### Public — "Stage"
- Near-black canvas `#0B0B0C`, surfaces `#141416`/`#1C1C1F`, warm white `#F5F2EC`, one accent: spotlight vermillion `#FF4A2B`. Accent and palette editable in Brand Settings with an automatic WCAG AA contrast check before publish.
- Type: *Archivo* variable (condensed uppercase display, 96–180px) + *Instrument Serif* italic accents + *Inter* body. Brand Settings offers four curated font pairings (fonts must be preloaded for performance, so free-form font upload is not offered).
- Editorial, asymmetric layouts; full-bleed video; split and sticky-media sections instead of repeated card grids; warm off-white sections for rhythm.
- Glass only on the floating header over media and on the booking sheet.
- Motion: scroll reveals, gentle parallax, page transitions. Fully disabled under `prefers-reduced-motion`; the hero video falls back to its poster on reduced motion and slow connections.

### Admin — "Studio"
- Light neutral workspace, dark collapsible sidebar, accent for primary actions only.
- Top bar with breadcrumbs, ⌘K search, notifications, branch switcher, profile menu.
- Tables with filters, saved views, column visibility, bulk actions, pagination, CSV export.
- Drawers for quick edits, dialogs for confirmations (destructive actions require typing the name for irreversible ones), toasts for feedback.
- Every screen: skeleton loading, empty state with a next action, error boundary with retry, success feedback.
- Mobile: sidebar becomes a sheet; tables become stacked rows; instructor and front-desk screens are phone-first.

---

## 5. Architecture

### 5.1 Layers

```
UI (Server/Client Components)
  → Server Actions / Route Handlers     parse input with Zod, build request context, call one service
    → Services (server/services/*)       authorize, apply business rules, run transactions, write audit
      → Domain logic (server/domain/*)   pure functions: billing math, schedule expansion, policy evaluation
      → Models (server/models/*)         Mongoose schemas with the tenant plugin
```

- Components never import models. Route handlers and actions contain no business rules.
- Pure domain functions (pricing, proration, tax, refund policy, schedule expansion, conflict detection) have no I/O and are tested exhaustively.
- Services throw a typed `AppError` for expected failures (so transactions abort cleanly); the action/route boundary converts it to the standard result. `AppError` codes map to HTTP status and form field errors. API shape: `{ ok, data?, error?: { code, message, fields? }, meta? }`.

### 5.2 Folder layout

```
src/
  app/
    (site)/            public pages (cached Server Components)
    (auth)/            login, register, reset, verify
    portal/            guardians and students
    admin/             staff workspace (menu filtered by permission)
    api/               auth, v1 (public JSON), t (analytics), uploads, exports, cron, webhooks
    manifest.ts sitemap.ts robots.ts sw.ts
  proxy.ts             coarse route gating only
  server/
    context/           AsyncLocalStorage request context (academyId, actor, requestId)
    auth/ rbac/ db/ models/ domain/ services/ validators/ actions/
    jobs/              cron jobs (outbox, waitlist, scheduled publish, sessions, rollups, reconciliation)
    integrations/      cloudinary, resend, whatsapp, maps, gateway (interface only)
    lib/               errors, result, money, time, pagination, ids, csv
  components/ ui | site | admin | portal | pwa
scripts/  seed.ts, backup.ts, restore-check.ts
tests/    unit | integration | e2e
docs/
```

### 5.3 Tenant isolation (enforced, not by convention)
- Every business document has `academyId`. Branch-owned documents also have `branchId`.
- Each request builds a context (`academyId`, `actor`, `branchScope`, `requestId`) held in `AsyncLocalStorage`.
- A Mongoose **tenant plugin** adds `academyId` to every find/update/delete/aggregate and to every insert, and **throws** if no context is present. Cross-tenant work (seed, migrations) must opt out explicitly with `withSystemContext()`, which is logged.
- All unique indexes are compound with `academyId`. Cloudinary folders are per academy.
- Integration tests prove a user of academy A cannot read or change any record of academy B.

### 5.4 Central authorization
- One policy file maps **roles → permissions** (`students.read`, `invoices.issue`, `refunds.approve`, `cms.publish`, …).
- Each staff user has a role and a **branch scope** (`all` or a list of branch IDs).
- `authorize(ctx, permission, resource?)` is the only gate. It checks the permission, then the scope against the resource's `branchId`, then ownership rules (a guardian only sees their household; an instructor only sees their batches).
- `scoped(ctx, Model)` returns a query already filtered by tenant and branch scope, so list pages cannot leak records by forgetting a filter.
- A generated test runs every role × permission × scope combination against the policy table.
- The UI reads the same policy to hide actions, but the server check is the only security boundary.

| Capability | Super Admin | Academy Admin | Branch Mgr | Instructor | Receptionist | Guardian / Student |
|---|---|---|---|---|---|---|
| Website CMS, brand, SEO, navigation | ✅ | ✅ | — | — | — | — |
| Users, roles, academy settings, data export | ✅ | ✅ (cannot change Super Admin) | — | — | — | own data export |
| Branches, rooms | ✅ | ✅ | own branch | view | view | public |
| Programs, fee plans | ✅ | ✅ | view | view own | view | public |
| Batches, schedules, sessions | ✅ | ✅ | own branch | view own | view | own |
| Households, students, documents | ✅ | ✅ | own branch | roster only | create, view | own household |
| Consent records | ✅ | ✅ | own branch | view flags | view | sign / revoke |
| Enrolments, waitlist | ✅ | ✅ | own branch | — | create pending | request |
| Attendance | ✅ | ✅ | own branch | own batches | view | own |
| Invoices, payments | ✅ | ✅ | own branch | — | record payment | own, view |
| Discounts above limit, refunds, write-offs | ✅ | ✅ | request | — | — | request |
| Leads, trials, inquiries | ✅ | ✅ | own branch | — | ✅ | own bookings |
| Events | ✅ | ✅ | own branch | view | registrations | register |
| Marketing, templates | ✅ | ✅ | — | — | — | — |
| Reports | ✅ | ✅ | own branch | own classes | — | — |
| Audit log | ✅ | ✅ | own branch (read) | — | — | — |

---

## 6. Modules

### 6.1 Academy, branches, rooms, facilities
- **Academy:** name, legal name, GSTIN, currency, default timezone, financial-year start, policies.
- **Branch:** address, geo point, timezone, contact, business hours and holidays, facilities, map, active flag.
- **Room:** branch, name, capacity, floor area, features (mirrors, sprung floor, sound system), bookable hours, active flag.
- **Facility block:** time-bound room or instructor unavailability (maintenance, private hire, holiday, leave), one-off or recurring.
- **Holidays** at academy or branch level skip session generation and are shown on schedules.

### 6.2 People
- **User:** Better Auth identity (email, password hash, verification), role, branch scope, status, last login. Credentials and auth sessions stay in Better Auth collections; profile data lives elsewhere.
- **Household:** the family and billing unit. Guardians (1–n users, with relationship and a primary contact), students (1–n), billing name and address, preferred channel, ledger balance (derived), credit balance.
- **StudentProfile:** household, name, date of birth, gender (optional), photo, level per style, medical notes (restricted field, visible to staff with `students.medical.read`), emergency contacts, optional own login (teens 13+ and adults), status (active, paused, alumni, suspended).
- **Instructor:** linked user, bio, specialties, experience, achievements, socials, photo, public profile flag, weekly availability, leave blocks, pay notes (private).
- **Staff:** users with staff roles and branch scope.
- An adult student is a household of one.

### 6.3 Consent and documents
- **ConsentTemplate:** type (`liability_waiver`, `medical_authorization`, `media_release`, `terms`, `code_of_conduct`, custom), rich-text body, **version**, required-for (enrolment, events, trials), active flag. Editing creates a new version.
- **ConsentRecord:** student, template + version, signer (guardian for minors, the student if adult), typed full name, consent checkbox, timestamp, IP, user agent, scope (for media: website, social media, print, promotional video), revoked at + by. Records are append-only.
- Enrolment is blocked until required consents for the current version are signed. When a template changes, affected households are asked to re-consent and staff see a "consent outdated" flag.
- **Media rule:** gallery items and testimonials can tag students. Publishing is blocked if any tagged student lacks a valid media consent for that channel. Revoking consent unpublishes affected items and alerts staff.
- **StudentDocument:** type (ID proof, birth certificate, medical certificate, photo ID, custom), file stored as a Cloudinary `authenticated` asset (never public), uploaded by, verified by + at, expiry date, notes. Files are fetched through a server route that checks permissions and returns a signed URL valid for 5 minutes. Expiring documents trigger reminders. Allowed types: PDF, JPEG, PNG, WebP, HEIC; 10 MB max.
- Required document types are configurable per program (e.g. birth certificate for age-category competitions).

### 6.4 Programs, fee plans, batches, sessions
- **Program:** style, slug, title, description (rich text), media, level, age range, duration, online/offline/hybrid, prerequisites, required documents and consents, instructors, SEO fields, status (draft/published/archived).
- **FeePlan:** name, type (`monthly`, `term`, `course`, `class_pack`, `drop_in`), amount, tax rate, tax-inclusive flag, registration fee, billing day, proration rule, late-fee rule, sibling-discount eligibility. Fee plans are **versioned**: changing a price creates a new version effective from a date; existing invoices keep their price.
- **Batch:** program, branch, room, instructor(s), level, age range, capacity, start/end dates, weekly schedule rules (`weekday`, `startTime`, `endTime` in branch local time), fee plan(s), online meeting link (online/hybrid), enrolment open flag, status.
- **ClassSession:** one dated occurrence (UTC start/end + branch timezone), room, instructor, status (scheduled, cancelled, rescheduled, completed), substitute instructor, notes. Generated 10 weeks ahead nightly; cancellations and reschedules notify enrolled students.
- **Timetable:** week and day views by branch, room or instructor; drag to reschedule with a live conflict check.

### 6.5 Trials, enrolment, waitlist, make-ups
- **TrialSlot:** program, branch, room, instructor, start/end, capacity. Generated from batch sessions marked "trial-friendly" or created manually.
- **TrialBooking:** slot, lead, student details (guardian for minors), status (`pending`, `confirmed`, `rescheduled`, `cancelled`, `attended`, `no_show`, `converted`), fee + payment if trials are paid.
- **Enrolment:** student, batch, fee plan version, status (`pending`, `active`, `paused`, `completed`, `cancelled`, `transferred`), start date, end date, source (trial, web, staff, waitlist), history of status changes.
- **Waitlist:** student, batch, position, priority (siblings or returning students optional), status (`waiting`, `offered`, `accepted`, `declined`, `expired`, `removed`), offer expiry.
- **Make-up credit:** granted when a student misses a class (or a session is cancelled), with a configurable cap per month and expiry. Redeemed into a session of another batch at the same program and level that has room.

### 6.6 Attendance
- Per session per student: `present`, `late`, `absent`, `excused`, `makeup`. Marked by instructor or staff; corrections are logged with reason.
- One-tap roster, QR check-in (student QR in the portal; instructor scans), bulk "mark all present".
- Reports: by batch, date range, student and instructor; percentage; streaks; students under a configurable threshold are flagged to the branch manager.
- Exports to CSV.

### 6.7 Finance (manual payments, auditable)
**Principle:** money records are append-only. Corrections are new entries, never edits.

- **Invoice:** household, student(s), number (`REMO/2026-27/000123`, gap-free per financial year), issue and due dates, line items (fee plan version, period, quantity, unit price, discount lines, tax lines), totals, status (`draft`, `issued`, `partially_paid`, `paid`, `overdue`, `void`). Issued invoices cannot be edited, only voided (with reason) or adjusted with a credit note.
- **Payment:** household, amount, method (`cash`, `upi`, `bank_transfer`, `card_pos`, `cheque`, `online` reserved), reference, received date, received by, branch, **idempotency key**, status (`recorded`, `reversed`), receipt number.
- **PaymentAllocation:** links part of a payment to one or more invoices (oldest-due first by default, editable). Unallocated amounts become household credit.
- **CreditNote:** reason, amount, linked invoice; requires `invoices.adjust`.
- **Refund:** request (reason, amount, policy calculation shown) → approval (`refunds.approve`) → recorded with method and reference. Never more than what was paid for that item.
- **Discounts:** coupon, sibling (automatic), early-bird, scholarship/manual. Manual discounts above a configurable percentage need approval. Order of application is fixed and documented: plan price → sibling → early-bird → coupon → manual → tax.
- **LedgerEntry:** append-only per household: `invoice_issued` (+), `payment` (−), `credit_note` (−), `refund` (+), `write_off` (−), `reversal`. Household balance = sum of entries.
- **Billing run:** a monthly job creates draft invoices for active enrolments on the billing day; staff review and issue in bulk (or auto-issue if enabled). Proration for mid-cycle joins per fee plan rule.
- **Late fees:** optional, per fee plan, after a grace period; added as a separate invoice line on the next invoice, never by editing a past invoice.
- **Memberships:** plan, period, auto-renew flag, renewal invoice generated before expiry, reminders before and after expiry.
- **Reports:** collections by method, day, branch and staff; outstanding by household; ageing (0–30, 31–60, 61–90, 90+); refunds; discounts given; GST summary.
- **Cash drawer close:** daily summary per branch per staff member for reconciliation.

### 6.8 Cancellation and refund policies
- **Policy** documents per type (trial, enrolment, event, membership), each with ordered rules: *notice ≥ N hours/days before start → refund X% (or credit Y%)*, plus non-refundable components (registration fee) and an admin-override permission.
- Policies are versioned and the version in force is stored on each booking, enrolment and registration, so later changes do not alter past terms.
- The policy text is published on the website and shown at booking; the refund screen calculates the suggested amount from the policy and shows the rule that applied.

### 6.9 Events and workshops
- Event: type (workshop, masterclass, competition, showcase, online), guest artist, date/time, venue (branch room or external), poster and gallery, ticket tiers with prices and capacity, registration deadline, required consents, status.
- Registrations use the same seat-hold mechanism as enrolment, produce an invoice, and support check-in by QR. Attendee export to CSV. Cancelling an event notifies registrants and opens refunds per policy.

### 6.10 CRM and leads
- Sources: trial booking, contact form, program inquiry, franchise inquiry, event registration, campaign landing page, walk-in, phone, referral.
- Leads are matched by phone or email to avoid duplicates; repeat contact adds activity to the existing lead.
- Pipeline: New → Contacted → Interested → Trial Booked → Converted / Lost (with lost reason). Board and table views.
- Owner assignment, next follow-up date, activity timeline (notes, calls, WhatsApp, emails), overdue follow-ups on the dashboard, conversion to household + student in one step.
- UTM parameters and landing page captured on every web lead.

### 6.11 Marketing
- Announcement bar and promotional banners with schedule, audience (all, logged-in, page-specific) and priority.
- Coupons: code, percent or fixed, scope (programs, events, fee plans), limits per code and per household, date range, minimum amount, usage report.
- Referral program: each household gets a code; reward credit to referrer on the referee's first paid invoice.
- Newsletter subscribers with double opt-in and unsubscribe.
- Campaign landing pages built with the CMS section builder, with their own lead source.
- WhatsApp CTA (number, default message per page) and social links in Brand Settings.

### 6.12 Notifications
- Channels: email, in-app, WhatsApp (adapter), web push for the PWA.
- Types: booking confirmation, trial reminder, enrolment approved, payment received, invoice issued, dues reminder, class reminder, schedule change, session cancelled, waitlist offer, event reminder, membership expiry, consent required, document expiring, announcement.
- **NotificationTemplate:** per type × channel, with variables (`{{student.firstName}}`, `{{session.startLocal}}` …), live preview, enable/disable, test send. WhatsApp templates store the provider's approved template name and parameter order.
- Recipient preferences per channel; WhatsApp sends only with recorded opt-in; quiet hours per academy.
- Delivery details are in section 7.7.

### 6.13 Website CMS
**Scope:** homepage, all pages, campaign landing pages, header navigation, footer, announcement bar, branding, SEO defaults, contact details, policies, and site settings. Programs, events, instructors, branches, testimonials and gallery are managed in their own modules and pulled into sections.

- **One content mechanism for everything editable:** each CMS item (page, navigation, footer, brand, SEO, settings) is a `ContentDocument` with a **draft**, a **published** version, and a **revision history**.
- **Autosave:** edits save to the draft 1.5 seconds after typing stops and on blur, with a visible "Saved / Saving / Offline" state. Drafts keep a `version` number; if someone else saved since you opened it, you see who and can reload or overwrite deliberately. An edit lock indicator shows who else is editing.
- **Preview:** "Preview" opens the real page in Next.js draft mode. The editor has a side-by-side preview with **Mobile (390), Tablet (820), Desktop (1440)** toggles that refreshes as you type.
- **Publish:** validates every section (required fields, alt text on images, link targets, contrast for brand colours), shows a diff summary, then publishes. Publishing creates an immutable `ContentRevision` and revalidates the affected cache tags so the live site updates within seconds.
- **Scheduled publishing:** pick a date and time (academy timezone); a job publishes it and records who scheduled it. Scheduled items can be cancelled. Unpublish can also be scheduled (e.g. for a campaign).
- **Revision history:** list of revisions with author, time and note; view any revision; compare with current; **restore** copies it into the draft (non-destructive) for review and publish.
- **Section builder:** add, reorder (drag and keyboard), duplicate, hide, and delete sections. Section types: Hero (video/image), Story, Stats, Program showcase, Why us, Instructors, Schedule teaser, Events, Testimonials, Gallery, Press/logos, FAQ, Branch locations, Rich text, Image + text, Video, CTA, Class Finder, Trial booking. Each type has a Zod schema and a dedicated form.
- **Pages:** create, edit, duplicate, delete (soft), slug with redirect from old slug, SEO (title, description, OG image, canonical, noindex), template, visibility.
- **Navigation and footer:** nested links (2 levels), internal page picker or external URL, open in new tab, enable/disable, drag reorder.
- **Brand:** logo (light/dark), favicon, app icon, colours (with contrast check), font pairing, social links, contact, business hours, WhatsApp settings.
- **SEO:** defaults, per-page overrides, sitemap (automatic), robots rules, structured data (organisation, each branch, programs as courses, events, FAQ), redirects manager.
- **Media library:** upload (drag and drop, multiple), folders and tags, required alt text, focal point for cropping, replace file in place, usage tracking ("used in 3 places") and deletion protection while in use.

### 6.14 Analytics and reports
- **Overview dashboard:** total and active students, new enrolments, trials, conversion rate, active programs, upcoming classes and events, monthly collections, outstanding dues, recent activity, revenue trend, enrolment trend, popular programs, branch comparison. All from live queries or nightly rollups, never hardcoded.
- **Visitor analytics:** cookieless beacon (page views, section views via visibility, CTA clicks), country and region from the edge request headers, referrer, UTM, device class. Raw events kept 90 days, daily rollups kept indefinitely. Honors Do Not Track. Optional GA4 / Meta Pixel IDs in settings for marketing teams that want them.
- **Reports** (date range, branch filter, CSV export): enrolment, revenue, payments, outstanding and ageing, attendance, trial conversion, lead conversion by source, program popularity, instructor performance (classes, attendance rate, retention), branch performance, website funnel.

### 6.15 Data export, backup, audit
- **Exports:** CSV for every list (respects filters and permissions). Super Admin can run a **full academy export** (JSON per collection, zipped) as a background job with a download link valid for 24 hours. Every export is audit-logged.
- **Data-protection requests:** a guardian or adult student can request a copy of their data or deletion. Deletion anonymises personal fields but keeps financial records required by law, and is approved by an admin. (Designed with India's DPDP Act in mind.)
- **Backups:** Atlas continuous backup with point-in-time restore on a production tier; plus a nightly encrypted `mongodump` to object storage as an independent copy, kept 30 days. Documented restore runbook and a scripted restore check against a scratch cluster, to be run monthly.
- **Audit log:** append-only (no update/delete permission in code; Atlas user for the app cannot delete from it), with actor, action, entity, before/after diff (sensitive fields masked), IP, user agent, request ID. Viewer with filters and export. Retained 3 years by default.

### 6.16 PWA for instructors and staff
- Installable app (`/admin` scope) with manifest, icons, splash and offline page.
- **Offline attendance:** today's and tomorrow's rosters are cached; marks made offline are stored in IndexedDB and synced when online. Each mark is an idempotent upsert keyed by session + student, with the device timestamp; conflicts resolve to the latest mark and are logged.
- Quick actions: today's classes, attendance, scan QR, add walk-in lead, record payment.
- Web push for schedule changes and assigned follow-ups (opt-in).

### 6.17 Portals
- **Guardian/student portal:** household overview, each child's classes, schedule, attendance, make-up credits, bookings, waitlist position, invoices and receipts, balance, consent forms, documents, certificates, notifications and preferences, data requests.
- **Instructor portal** (inside `/admin`, restricted): today, week schedule, rosters with consent and medical flags, attendance, availability and leave, own performance.

---

## 7. Business logic rules

### 7.1 Seats, holds and capacity
- Capacity is enforced at the moment of commit, inside a MongoDB transaction:
  1. Write to the batch's lock document (increment `seatVersion`). Concurrent transactions on the same batch now conflict, and MongoDB retries one of them, so they run one at a time.
  2. Count active enrolments + unexpired seat holds + outstanding waitlist offers for the batch.
  3. If the count is below capacity, insert the hold or enrolment; otherwise return `BATCH_FULL` and offer the waitlist.
- **Seat holds** (`SeatHold`) reserve a seat for 15 minutes while a guardian completes enrolment, consent and details. Expired holds stop counting automatically because the count filters on `expiresAt > now`; a TTL index deletes them later. No counter can drift.
- `enrolledCount` is stored on the batch only for display, updated in the same transaction, and reconciled nightly.
- The same mechanism protects trial slots and event ticket tiers.
- Enrolment validation also checks: batch active and not ended, enrolment open, age within range (on the batch start date), level prerequisites, required consents and documents, student not suspended, no existing active enrolment in the same batch (partial unique index), and warns on clashing schedules for the same student.

### 7.2 Waitlist and offers
- When a seat frees (cancellation, transfer, capacity increase, hold expiry), the job offers it to the first `waiting` entry by priority then join time.
- The offer reserves the seat (counted in 7.1) and expires after a configurable window (default 24 hours, minimum 2). The guardian is notified on all enabled channels.
- Accept → enrolment created in the same transaction that consumes the offer. Decline or expiry → next person is offered. Each step is idempotent, so re-running the job never double-offers.
- Staff can skip, reorder (with reason) or remove entries. Guardians see their position.

### 7.3 Idempotent payments
- Each payment form gets an idempotency key when opened. The key is unique per academy. Submitting twice (double click, retry, flaky network, offline replay) returns the first result instead of creating a second payment.
- Recording a payment runs in one transaction: payment → allocations → ledger entries → invoice status updates → receipt number from the counter. If anything fails, nothing is written and no receipt number is consumed.
- Reversing a payment creates a reversal entry; the original stays visible.
- Reserved for the gateway later: webhook events deduplicated by provider event ID; amount and currency verified server-side against the invoice before any ledger entry.

### 7.4 Fee and balance accuracy
- All money in integer minor units. Tax is computed per line with "round half up" to the paisa, and the invoice total is the sum of rounded lines, so printed lines always add up.
- Pricing, proration, discount ordering, tax and refund-policy calculations live in pure functions with unit and property-based tests (e.g. "allocations never exceed invoice total", "balance equals sum of ledger", "refund never exceeds amount paid").
- Invoice `amountPaid`/`balance` and the household balance are derived values updated in the same transaction as the ledger; a nightly reconciliation job recomputes them from the ledger and raises an alert on any mismatch.

### 7.5 Time and schedules
- Schedules are defined in the **branch's local time** and IANA timezone; sessions are stored in UTC. Expansion uses `@date-fns/tz`, so daylight-saving changes in any future non-India branch are handled correctly.
- Times are displayed in the branch timezone with its label; online sessions also show the viewer's local time.
- "Today", billing days, reminders, scheduled publishing and reports use the relevant timezone (branch or academy), never the server's.

### 7.6 Conflicts (rooms and instructors)
- Every time-bound use — class session, trial slot, event, facility block, instructor leave — is checked for overlap against the same room and the same instructor.
- Saving a batch expands its rules across its date range and checks all occurrences before saving. Conflicts are listed with date, time and what they clash with; staff can adjust or, with permission, override one occurrence.
- Concurrent writes are serialised per room per day using the same lock-document technique as seats.
- Instructor availability windows and leave are respected; substitutes are suggested from instructors free at that time who teach that style.

### 7.7 Notification delivery
- **Outbox pattern:** business transactions write `Notification` records (one per recipient per channel) in the same transaction as the change that triggers them, so a notification is never lost or sent for a change that rolled back.
- A **dedupe key** (type + entity + recipient + channel + occurrence) is unique, so a reminder is never sent twice.
- A worker claims due notifications with a lease (`lockedUntil`) so two workers never send the same one.
- Status: `queued → sending → sent → delivered / bounced / failed`, with attempts, last error and provider message ID. Provider webhooks (Resend; WhatsApp status callbacks) update delivery status.
- Retries with exponential backoff (1 min, 5 min, 30 min, 2 h, 12 h), then `dead` and visible in an admin "Delivery issues" view with manual retry.
- Respect preferences, opt-in and quiet hours (messages wait until quiet hours end).

### 7.8 Other invariants
- Unique per academy: slugs, invoice/receipt numbers, coupon codes, user email, one active enrolment per student per batch, one trial booking per phone per program per day, one event registration per student per tier.
- Soft delete for business records that other records reference; hard delete only for drafts and unused media.
- Every mutation writes an audit entry in the same transaction.

---

## 8. Data model (final)

**Identity & org:** User*, Session*, Account*, Verification* (*Better Auth), Academy, Branch, Room, FacilityBlock, Holiday
**People:** Household, StudentProfile, Instructor, StaffProfile
**Consent & documents:** ConsentTemplate, ConsentRecord, StudentDocument
**Catalogue & schedule:** Program, FeePlan, Batch, ClassSession, TrialSlot
**Operations:** TrialBooking, Enrollment, SeatHold, Waitlist, MakeupCredit, Attendance, Membership, Certificate
**Finance:** Invoice, Payment, PaymentAllocation, CreditNote, Refund, LedgerEntry, Coupon, CouponRedemption, Counter, Policy
**Events:** Event, EventRegistration
**CRM & marketing:** Lead, LeadActivity, ContactInquiry, Subscriber, Referral, Banner
**Content:** ContentDocument (pages, navigation, footer, brand, SEO, settings), ContentRevision, Testimonial, GalleryItem, MediaAsset, Redirect
**System:** Notification, NotificationTemplate, NotificationPreference, AuditLog, AnalyticsEvent, AnalyticsDaily, RateLimit, Job (export/backup jobs), DataRequest, IdempotencyKey

`docs/DATABASE.md` (Phase 1) will list every field, reference, index and invariant with a relationship diagram.

---

## 9. Security
- Better Auth: scrypt password hashing, email verification, password reset with single-use expiring tokens, session cookies `HttpOnly; Secure; SameSite=Lax`, session revocation on suspension, role or password change, optional 2FA (TOTP) for staff roles.
- Server-side authorization on every action (section 5.4) and tenant enforcement (section 5.3).
- Zod validation on every input; queries built only from validated values (no operator injection); `strictQuery` enabled.
- CSRF: Server Actions' built-in origin checks; state-changing route handlers verify `Origin` and session; webhooks verify provider signatures.
- XSS: rich text stored as JSON and rendered through an allow-list; strict Content-Security-Policy with nonces; security headers (HSTS, frame-ancestors, referrer policy, permissions policy).
- Uploads: server-signed, folder-restricted, type and size checked; private documents in authenticated storage with short-lived signed URLs.
- Rate limits on auth, public forms, exports and uploads; honeypot + time trap; optional Turnstile.
- Secrets only in server environment, validated at startup; nothing secret in client bundles (checked in CI).
- Sensitive fields (medical notes, documents, staff pay notes) behind separate permissions and masked in audit diffs.
- Demo admin created only by the seed script from environment values; seed refuses to run against a production database.

## 10. Performance and SEO
- Public pages statically rendered and revalidated by cache tags on publish; interactive parts are small client islands.
- `next/image` with a Cloudinary loader (AVIF/WebP, responsive sizes, blur placeholders); hero video as adaptive MP4/WebM with poster.
- Indexed queries everywhere, cursor pagination for large lists, aggregation rollups for dashboards.
- Targets on mobile: LCP < 2.0 s, CLS < 0.05, INP < 200 ms, Lighthouse ≥ 95 on public pages.
- Metadata per page from the CMS, canonical URLs, dynamic sitemap, robots, generated OG images, JSON-LD.

## 11. Testing
- **Unit:** domain functions (billing, proration, discounts, tax, refund policy, schedule expansion, conflicts, timezone edge cases) including property-based tests.
- **Integration:** services against an in-memory replica set: concurrent enrolment for the last seat (50 parallel attempts → exactly one success), waitlist offer expiry, idempotent payment replay, ledger reconciliation, tenant isolation, role × permission matrix, outbox retries.
- **End-to-end (Playwright):** trial booking, guardian registration with two children, enrolment with consent, payment recording and receipt, attendance offline sync, CMS edit → preview → schedule → publish → restore, RBAC denial.
- **Quality gates in CI:** typecheck, lint, unit + integration tests, production build, Lighthouse on key public pages.

## 12. Build phases

Every phase ends with: typecheck and lint clean, production build passes, that phase's tests pass, visual check at 390 / 820 / 1440 px, and `docs/CHECKLIST.md` updated. Nothing is called done unless it was run.

| # | Phase | Delivers |
|---|---|---|
| 1 | **Foundation** | Scaffold, env validation, DB + transactions, request context, tenant plugin, RBAC policy + tests, Better Auth, audit log, rate limits, errors/results, core models, seed skeleton, `ARCHITECTURE.md`, `DATABASE.md` |
| 2 | **Design systems** | Stage and Studio tokens, typography, motion presets, public layout and section kit, admin shell (sidebar, top bar, ⌘K, breadcrumbs, branch switcher), DataTable, form kit, state patterns |
| 3 | **Academy core** | Branches, rooms, facility blocks, holidays, programs, fee plans, instructors + availability, batches, conflict detection, session generation, timetable |
| 4 | **Public website** | Homepage from sections, About, Programs + detail, Classes with live seats, Instructors, Events, Gallery, Testimonials, Contact + map + FAQ, policies, SEO |
| 5 | **Website CMS** | Content documents, autosave, revisions, restore, preview with device sizes, scheduled publishing, section builder, pages, navigation, footer, brand, SEO, redirects, media library |
| 6 | **Families, consent, enrolment** | Registration, households, students, consent templates + signing, documents, enrolment workflow, seat holds, waitlist offers, transfers, guardian portal |
| 7 | **Conversion & CRM** | Trial slots + booking flow, Class Finder, leads pipeline, activities, follow-ups, inquiries, trial → enrolment conversion |
| 8 | **Attendance & staff PWA** | Rosters, QR check-in, offline sync, make-up credits, attendance reports, instructor portal, installable PWA |
| 9 | **Finance** | Fee plan versions, billing run, invoices, payments + allocations, ledger, credit notes, refunds + approvals, policies, discounts, coupons, referrals, memberships, receipts/invoices PDF, ageing, cash close, certificates |
| 10 | **Events, marketing, notifications** | Events + tickets + check-in, banners, campaigns, newsletter, templates, outbox worker, email/WhatsApp/push adapters, delivery tracking, all reminders |
| 11 | **Analytics & reports** | Overview dashboard, visitor analytics, all reports with filters and CSV |
| 12 | **Data, hardening, launch** | Full export, data requests, backup scripts + restore check, full demo seed, Playwright suite, security review, Lighthouse, documentation set, deployment |

## 13. Deliverables
Application, seed data (`npm run seed`), `.env.example`, and in `docs/`: `SETUP.md`, `ARCHITECTURE.md`, `DATABASE.md`, `API.md`, `SECURITY.md`, `DEPLOYMENT.md`, `BACKUP.md`, `TESTING.md`, `CHECKLIST.md`.

## 14. Out of scope for v1 (designed for, not built)
- Online payment gateway (interface reserved; Razorpay planned).
- Native mobile apps (PWA covers staff; the portal is responsive).
- Instructor payroll calculation (pay notes only).
- Multi-academy SaaS billing and sign-up (data model is tenant-ready).
- Live streaming (online classes use a meeting link).

## 15. Confirmed decisions (2026-11-01)

1. **Hosting: Vercel free plan + external scheduler.** Jobs are exposed as `POST /api/cron/[job]`, protected by a `CRON_SECRET` bearer token. An external scheduler (cron-job.org, every 1–5 minutes) calls the frequent jobs (outbox, waitlist offers, scheduled publishing, seat-hold cleanup); a GitHub Actions workflow is provided as a fallback. Daily jobs (session generation, billing run, rollups, reconciliation) can also use Vercel's once-a-day cron. Every job is idempotent and safe to run late or twice.
2. **Billing: monthly, billed in advance on the 1st, prorated for mid-month joins, not GST-registered.** Tax lines are off by default; GST can be switched on later in Academy Settings (GSTIN, rate, inclusive/exclusive) without code changes.
3. **Logins: guardians manage children under 18; students aged 13+ can get an optional view-only login.** Adults manage themselves.
4. **Data region: MongoDB Atlas, Mumbai (`ap-south-1`).** Local development uses a single-node replica set.
