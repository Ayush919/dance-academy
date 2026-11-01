# Feature checklist

Updated at the end of every phase. A box is ticked only when the feature is implemented **and** verified (tests, build, and a manual run where applicable).

## Phase 1 — Foundation ✅ (2026-11-01)
- [x] Next.js 16.4 (App Router, Turbopack, Cache Components), React 19, TypeScript strict + `noUncheckedIndexedAccess`
- [x] Tailwind CSS 4, ESLint, Prettier
- [x] Validated server environment (`src/server/env.ts`), `.env.example`
- [x] MongoDB connection shared by Mongoose and Better Auth; local replica set scripts (`db:dev`, `db:stop`)
- [x] Transactions with automatic session propagation (`withTransaction`)
- [x] Request context (AsyncLocalStorage): academy, actor, request ID, IP, user agent
- [x] Tenant isolation plugin: filtered reads/writes/aggregations, stamped inserts, cross-tenant writes refused, no-context queries refused, `bulkWrite` refused
- [x] Central RBAC policy (7 roles × 72 permissions × 4 scopes), `authorize()`, `can()`, `scopeFilter()`
- [x] Better Auth: email + password, scrypt hashing, password reset, optional email verification, HTTP-only `remo.` cookies, suspended-user block, privileged fields locked at sign-up, rate limits, cross-origin rejection
- [x] Proxy redirect for `/admin` and `/portal` without a session cookie
- [x] Append-only audit log with masked diffs and 3-year retention
- [x] Gap-free per-academy counters; Indian financial-year labels
- [x] MongoDB-backed rate limiter with presets
- [x] Standard error codes and result shape; `defineAction` / `defineRoute` boundaries; same-origin check helper
- [x] Email adapter (Resend, log fallback in development)
- [x] Models: Academy, Branch, Room, AuditLog, Counter, RateLimit
- [x] Idempotent seed: Remo Dance Company, 2 branches, 5 rooms, super admin from env; refuses remote DBs without opt-in
- [x] `/api/health`
- [x] Docs: SPEC, SETUP, ARCHITECTURE, DATABASE, CHECKLIST

**Verification**
- `npm run typecheck`, `npm run lint`, `npm run build`: pass.
- `npm test` (run against the local replica set via `TEST_MONGODB_URI`): 44 tests pass (RBAC policy and scopes; tenant isolation across two academies; concurrent gap-free numbering and rollback; audit immutability and rollback; rate limits under concurrency; sign-up hardening, hashing, cookies, suspended accounts).
- Live run (`next start`): health OK; `/admin` → `/login?next=/admin`; wrong password 401; admin sign-in 200 with `super_admin` session; cookie HTTP-only; cross-origin sign-in 403; 6th failed sign-in from one IP 429.

**Not in this phase:** UI (Phase 2); the `/login` page does not exist yet, so the proxy redirect currently lands on a 404.

**Not yet verified:** `npm test` without `TEST_MONGODB_URI` (the in-memory replica set downloads a MongoDB binary on first run; this will be exercised when CI is added in Phase 12).

## Phase 2 — Design systems ✅ (2026-11-01)
- [x] Two token sets in one stylesheet: **Studio** (admin, default) and **Stage** (`data-theme="stage"`: public site, auth), plus an ivory band for light sections; brand accent as a token
- [x] Fonts via `next/font`: Archivo variable (width axis, condensed display), Instrument Serif italic accents, Inter body; fluid display type scale
- [x] Motion: `MotionProvider` (reduced motion honoured everywhere), `Reveal`, `RevealLines`; CSS animations off under reduced motion
- [x] shadcn/ui (Radix) base with brand button variants (`brand`, `stage-outline`, `xl`)
- [x] Shared states: `EmptyState`, `ErrorState` (error boundaries), `ConfirmDialog` (type-to-confirm for irreversible actions), skeletons, `PageHeader`
- [x] Form kit: `useActionForm` (React Hook Form + shared Zod schema + server field errors + toasts), `TextField`, `PasswordField`, `TextareaField`, `CheckboxField`
- [x] Server-driven `DataTable`: URL search/sort/pagination, column visibility, stacked cards on phones, empty and no-match states; `parseListParams` / `paginate` helpers
- [x] Auth screens: sign in, register (guardian), forgot password, reset password, verify email; server-side role routing (`/auth/continue`) with open-redirect protection
- [x] Admin shell: dark collapsible sidebar (permission-filtered, "Soon" for unbuilt modules), top bar, breadcrumbs, ⌘K palette, branch switcher (persisted, access-checked), notifications popover, profile menu, loading/error/not-found states
- [x] Admin pages on real data: dashboard setup checklist (live counts), Branches & rooms table
- [x] Public layout: floating glass header with mobile full-screen menu, footer with live branch addresses/phones/directions, skip link; section kit (`Hero`, `Marquee`, `EditorialSplit`, `CtaBand`, `Section`, `SectionHeading`); homepage composed from CMS default content
- [x] Portal shell for guardians and students (server-gated)

**Verification**
- `npm run typecheck`, `npm run lint` (1 known warning: TanStack Table opts out of React Compiler memoisation), `npm run build`: pass.
- `npm test`: 60 tests pass (adds phone normalisation, redirect safety, sign-up validation, list-parameter parsing).
- Browser checks at 1440, 390 (and the admin sidebar sheet): homepage, sign-in (validation + wrong password + success), admin dashboard, branches table (search, ⌘K jump), branch switcher persistence, sign-out, registration (validation + success → portal), guardian blocked from `/admin` server-side. No horizontal scrolling at 390px.
- Bugs found and fixed during checks: headline reveal never firing on wide headlines; ⌘K palette crash; hero spotlight pointing off-screen; table search box not following the URL; email with surrounding spaces rejected; blank page-size select.

**Not in this phase:** public pages linked from the menu (Programs, Classes, Events, Gallery, About, Contact, Book a trial) arrive in Phase 4 and currently 404; terms/privacy pages arrive with the CMS (Phase 5); tablet width (820px) was not separately screenshotted.

## Phase 3 — Academy core ✅ (2026-11-01)
- [x] Scheduling domain (pure, tested): weekly rules → dated classes in the branch timezone (DST-safe), holiday skipping, overlap detection, slot validation, availability windows
- [x] Models: Program, FeePlan (immutable versions), Instructor, Batch, ClassSession, Holiday, FacilityBlock; enums in a client-safe module; all models registered once at connection
- [x] Branches: create, edit (timezone locked while batches run), archive (refused while batches run), opening hours, facilities, map coordinates
- [x] Rooms: add/edit/deactivate; capacity can't drop below a running batch's size; deactivation refused while in use
- [x] Holidays (branch or academy-wide): cancel that day's classes, restore them when removed
- [x] Room and instructor blocks: refused over booked classes unless you choose to cancel them; blocks stop future bookings
- [x] Fee plans: monthly, term, course, class pack, drop-in; registration fee, billing day, proration rule, late fee, sibling eligibility; every change is a new version with history; archive/restore guarded by usage
- [x] Programs: full profile, level/ages/format, instructors and fee plans, cover image link, SEO fields, draft/published/archived, featured, order; archive guarded
- [x] Instructors: profile, styles, branches, weekly availability, private pay notes (hidden from roles that can't manage instructors)
- [x] Batches: program, branch, room, instructors (lead first), seats, ages, weekly times, dates, fee plans, online link, enrolment/trial flags, status; suggested codes; live clash preview while editing
- [x] Conflict rules: room double-booking, instructor double-booking, room blocks, instructor leave, room capacity — errors; outside availability — warning. Checked on save inside a transaction that locks the room and instructors, so simultaneous bookings can't both win
- [x] Classes: ten weeks generated on save and topped up daily; schedule edits move future classes (manual moves kept); move, cancel (with reason) and restore single classes with the same clash rules
- [x] Timetable: week grid by branch with room/instructor filters, lanes for parallel classes, holidays marked, phone agenda view, class details sheet with actions
- [x] Scheduled jobs: `/api/cron/[job]` with bearer secret (Vercel daily cron + GitHub Actions fallback); `generate-sessions` is idempotent
- [x] Admin: Programs, Fee plans, Instructors, Batches, Timetable enabled; branch switcher drives Batches/Timetable/Dashboard; dashboard checklist uses live counts and lists today's classes; readable breadcrumbs
- [x] Demo seed: 6 fee plans, 6 fictional instructors, 8 programs, 10 batches across both branches (≈200 classes), Christmas holiday

**Verification**
- `npm run typecheck`, `npm run lint` (same single known warning), `npm run build`: pass.
- `npm test`: 90 tests pass. New: 13 schedule-domain tests (incl. DST and property-based checks) and 17 scheduling integration tests — generation and idempotency, room/instructor/capacity clashes, back-to-back allowed, **two simultaneous bookings of one slot → exactly one wins**, schedule/time edits resync future classes, holiday cancel/restore, blocks, reschedule into busy vs free slots, cancel/restore, fee plan versions, branch-manager and instructor permission denials, tenant isolation.
- Live: cron endpoint 401 without secret, 404 for unknown jobs, idempotent run (0 new classes on re-run); seed re-run skips the catalogue.
- Browser: all new admin pages load without errors; timetable grid with real data; batch edit shows a live Studio B clash and disables Save; dashboard counts; no horizontal scroll at 390px on timetable, batches, fee plans, branch closures, batch detail.
- Bugs found and fixed: parallel reads inside transactions (MongoDB rejects them); request-context store duplicated across server bundles (jobs ran without a tenant); a model not registered before `populate`; blank Select values; raw IDs in breadcrumbs.

**Not in this phase / known gaps:** recurring facility blocks (one-off only); drag-to-reschedule on the timetable (a Move dialog instead); instructor logins (staff invitations come with Staff & roles); program/instructor images by URL until the media library (Phase 5); rich-text descriptions are plain paragraphs until the CMS editor. Screenshots of the new screens were limited because the browser pane was hidden for part of the check; layout was verified through DOM measurements instead.

## Phase 4 — Public website ✅ (2026-11-01)
- [x] Public data layer (`src/server/services/public.ts`): cached, tag-revalidated reads of the published catalogue, batches with live seats and "from" prices, instructors, studios, events, gallery, testimonials; facts derived from data (never typed in)
- [x] Homepage: hero, style ticker from real programs, story, live facts strip, featured programs, why-us, instructors, upcoming events, testimonials (when approved ones exist), studios, closing CTA; sections hide when empty and section numbers never skip
- [x] Programs: search + style/level/age/studio/format filters + sort + pagination (URL-driven); SEO detail pages (pre-rendered) with facts panel, description, highlights, instructors, fees, open batches with seats, related programs (overlapping ages)
- [x] Classes: every open batch with schedule, studio/room, seats left ("Only N left", "Full — join the waitlist"), price; filters for program, studio, day, time of day, level, age, availability
- [x] Instructors list + profiles (achievements, socials, the batches they teach)
- [x] Events list + detail (date, venue, price, places left, cancelled state); registration is an enquiry until Phase 10
- [x] Gallery with category filter and keyboard lightbox (images, video files, YouTube); empty state until media is uploaded
- [x] About: story, philosophy, live facilities, team, studios
- [x] Contact: enquiry form (stored), studio panels with maps, phone/WhatsApp, opening hours, FAQ
- [x] Book a trial: request form (stored as a trial request) pre-filled from program/batch links; Phase 7 replaces it with live slot booking
- [x] Spam protection: per-IP rate limit, honeypot and time trap (silently dropped), consent checkbox
- [x] Image system: `StageImage` shows real photos (Cloudinary optimised, other links as-is) or a designed stage-light panel; no external stock imagery used
- [x] SEO: per-page metadata and canonicals, Open Graph, generated share image, dynamic sitemap, robots, JSON-LD (DanceSchool + branches, Course, Event, Person, FAQPage, BreadcrumbList); styled 404
- [x] Security headers (HSTS, nosniff, frame, referrer, permissions)
- [x] Seed: 4 upcoming events relative to today

**Verification**
- `npm run typecheck`, `npm run lint` (same one known warning), `npm run build`: pass. Program, instructor and event pages are pre-rendered; listings with filters stream behind Suspense.
- `npm test`: 102 tests pass (adds program/batch filters, pagination, structured data, inquiry storage, honeypot/time-trap drop, rate limit, consent/message rules, form round-trips).
- Browser: homepage, program detail and classes checked visually at 1440 and 390; all 11 public pages load without errors and with no horizontal scroll at 390; contact form submitted end to end (stored with normalised phone and linked program, then deleted); sitemap (27 URLs), robots, OG image and security headers checked.
- **Bug found and fixed:** forms sent already-validated values to the server, which validated them again — the fee-plan form would have stored prices ×100 (rupees→paise twice) and the contact form failed silently on a hidden field. Forms now send raw input, and server errors on hidden fields always show a message.

**Not in this phase:** real photography (none supplied; the stock site's bot check meant I didn't source stock images); testimonials and gallery content (no fabricated reviews seeded; they come from moderation and uploads in Phase 5); founder, journey, awards and press sections on About (CMS-editable in Phase 5); online event registration (Phase 10); live trial slot booking (Phase 7); admin view of enquiries (CRM, Phase 7) — they are stored now.

## Phase 5 — Website CMS ✅ (2026-11-01)
- [x] Content model: drafts with optimistic versions, published copies, immutable revisions, scheduling, editing presence, media usage tracking, redirects (`src/server/models/content.ts`, `src/server/services/content.ts`)
- [x] Schema-driven sections (17 types: hero, page hero, marquee, story, image + text, numbered points, facts, programs, instructors, events, testimonials, gallery, studios, FAQ, text, video, call to action); live-data sections fill themselves from the catalogue
- [x] Page builder: drag-and-drop and keyboard reordering, hide, duplicate, delete, add-after-selected, per-page SEO (title, description, share image, noindex)
- [x] Editor: 1.5 s autosave, save on tab switch, unsaved-changes warning, conflict detection with reload, "also editing" notice, live preview at phone/tablet/desktop widths, publish dialog with change summary and blocking issues, schedule publish/take-down (IST), version history with restore, discard draft, take offline
- [x] Pages: create from templates (landing, blank, policy) that start with publishable sample copy, change address (old one redirects), soft delete; built-in pages protected
- [x] Site settings: navigation (header, footer, header button), brand (name, logo, favicon, colour with live contrast check, font pairing, contact, socials, WhatsApp message, announcement bar), SEO (title template, defaults, share image, indexing, Google verification)
- [x] Public site renders from the CMS: home, about, privacy, terms, refund policy and any new page; header, footer, announcement bar, theme colour, fonts and metadata come from settings; sitemap includes published pages; redirects and 404s
- [x] Media library: drag-and-drop upload (type checked by content, size limits), Cloudinary signed direct upload in production / local disk in development, search, folders, details (alt, caption, focal point, tags), "where used", delete blocked while in use; picker used across the CMS, program covers and instructor photos
- [x] Gallery manager: add from the library or YouTube, category, caption, publish/hide, drag-to-reorder, remove
- [x] Testimonials: moderation queue (pending / on the website / rejected with counts), approve, reject, take down, feature, reorder, edit, add reviews collected in person; public `/share-your-story` form with consent, rate limit, honeypot and time trap
- [x] Redirects page; `publish-scheduled` job (every 10 min via GitHub Actions, daily Vercel backstop)
- [x] Sidebar: Website, Media library, Gallery, Testimonials enabled

**Verification**
- `npm run typecheck`, `npm run lint` (0 errors; 2 known React Compiler notices about React Hook Form `watch` and TanStack Table), `npm run build`: pass.
- `npm test`: 126 tests pass (adds publish rules, link safety, contrast, change summaries, file sniffing, YouTube parsing, gallery/story validation; and against MongoDB: page creation and reserved slugs, every template publishable, version conflicts, permissions, revisions immutable and restore non-destructive, publishing blocked on issues, built-in pages kept online, scheduled publish/take-down idempotent, rename redirects without loops, media delete blocked while used, story moderation and featuring rules).
- Browser (localhost, signed in as the seeded owner): created pages from the hub, autosave confirmed after reload, publish blocked with clear per-section issues, published a page (live at its path, draft pages 404), draft preview iframe shows unpublished changes, renamed a page (old address 308-redirects), submitted a story on the public form → approved → shown on the homepage → taken down and rejected, uploaded a generated test image → added to the gallery → live on `/gallery` and the homepage → hidden, program form shows the library picker. No horizontal scroll at 375 px on the hub, editor, gallery, testimonials, redirects, story form and a CMS page.
- **Bugs found and fixed:** testimonial counts always showed 0 (an extra string `academyId` match in the aggregate); saving an existing revision document was not refused; the "New page" dialog stayed open in the background route after navigating; dnd-kit hydration mismatch in the section builder; the gallery dialog showed two alt-text fields; a draft page's header said "Live at"; new landing pages started with ten blocking issues (templates now start from sample copy).

**Not in this phase / known gaps:** media-consent checks for students shown in gallery photos and reviews (needs students and consents, Phase 6); the Cloudinary upload path is implemented but not exercised end to end here (no Cloudinary credentials in development, so local disk was used); rich text is a safe mini-markup (`## heading`, `- list`), not a WYSIWYG editor; editing presence is a notice, not a lock (conflicts are still caught); large video files should go through Cloudinary in production because Vercel limits request bodies on the local-upload route. Screenshots were limited because the browser pane was hidden for part of the check; layout and state were verified through DOM reads instead.
**Local test data left in the development database:** draft pages "Summer Dance Camp" and "Monsoon Workshop" (taken offline; its old address `/monsoon-workshop` still redirects to the now-offline `/monsoon-2027`), a rejected test review, a hidden test gallery item and the uploaded `test-stage.png` in the media library.

## Phase 6 — Families, consent, enrolment ✅ with one gap (2026-11-01)
- [x] Households and students: a parent's family is created on first use; dancers (children, or an adult registering themselves) with date of birth, emergency contacts, restricted medical notes, levels per style, status; studio can create walk-in families and link a parent's sign-up by email
- [x] Consent forms: versioned templates (liability waiver, media release, code of conduct, terms, custom), required for enrolment / events / trials; signing with typed name, IP and device, media scopes (website, social, print, video); changing the wording creates a new version and asks families to sign again; append-only signatures; withdrawal keeps the record; studio can record a paper signature on a family's behalf
- [x] Media rule: gallery items and reviews can tag students; publishing or approving is refused without a current media release for the website; withdrawing a release takes tagged items down immediately
- [x] Student documents: private storage, content-checked uploads, studio verification and expiry dates, per-program required documents, permission-checked and audited downloads
- [x] Enrolment: eligibility (age on start date, level, suspended, ended or closed batch, duplicate), forms and documents checked at commit, fee plan version recorded, schedule-clash warnings, 15-minute seat holds, capacity enforced under concurrency
- [x] Waitlist: join when full, place shown to families, offers in order (priority, then join time) with a 24 h window, accept / decline / expiry, studio can change order (with a reason) or remove
- [x] Transfers between batches, pause / resume / cancel with history and required notes, seats freed go to the waitlist
- [x] Guardian portal: family home (dancers, classes, waitlist places, seat offers, to-do), dancer page (classes, forms, documents, details), enrolment checklist, family and billing details; "Enrol now" / "Join waitlist" on every public class
- [x] Admin: students, families, enrolments (list and per-batch roster with waitlist), consent forms; students and families in the sidebar
- [x] Jobs: `waitlist-offers` (every 10 minutes) and `reconcile-seats` (daily); starting consent forms in the seed

**Verification**
- `npm run typecheck`, `npm run lint` (0 errors; 2 known React Compiler notices), `npm run build`: pass.
- `npm test`: 144 tests pass (adds 18 against MongoDB: forms block enrolment until signed; versioning keeps old signatures; signatures can't be edited or deleted; **8 families racing for 3 seats enrol exactly 3**; a live hold counts and an expired one stops counting with no job; age, duplicate and suspended checks; a family can't enrol another family's child; required documents with studio override; waitlist order, priority, decline and expiry passing the seat on; accepting an offer makes one enrolment; transfers and full-batch refusal; branch managers can't transfer into branches they don't run; status rules and history; media rule and revocation).
- Browser (localhost, as the studio owner): created a family and a dancer, recorded three paper signatures, enrolled the dancer from the studio dialog (advanced batch refused for age, fee plan required), roster and public seat count updated (35 → 34), gallery item refused for a tagged dancer without a release, accepted once the release was recorded, then withdrawing the release took it off the public gallery at once. Uploaded a private document; an HTML file disguised as a PNG was refused; the file is served with `private, no-store`, `nosniff` and a sandbox policy; anonymous download and upload return 401. No horizontal scroll at 375 px on students, student, families, family, enrolments, roster, consent forms and the form editor.
- Signed in as the demo parent through the API: `/portal`, `/portal/family`, `/portal/students/new` and `/portal/enrol/[batch]` render.
- **Bugs found and fixed:** two indexes on the signature collection had the same name; the consent guard rejected Mongoose's own `updatedAt` write; `ensureHousehold` could return "undefined" when the account row was missing; a transfer reported the wrong reason when the enrolment had already moved; two effects set state in a way the React Compiler rule rejects.

**Gap: the signed-in parent's screens were not clicked through in the browser.** I couldn't sign in as the demo parent in the browser pane (reading the account's password from `.env.local` was blocked), so `EnrolFlow` (hold timer, signing inside the checklist, fee plan choice, join waitlist), the seat-offer card, and the portal home with dancers were checked only through the services and tests (which act as a guardian) and by rendering the pages. The shared pieces (consent signing, student form, household form, documents panel) were exercised through the studio screens. Phone-width layout of the portal pages is likewise unchecked. Local demo parent: `SEED_GUARDIAN_EMAIL` / `SEED_GUARDIAN_PASSWORD` in `.env.local`.

**Not in this phase / known gaps:** students' own logins (teens 13+, view-only): the data model and permissions exist, but there is no invite flow yet; parents can't invite a second parent themselves (the studio links one by email); parents can't pause or cancel a class (the studio does; cancellation and refund rules arrive with finance); enrolling records the fee plan version but creates no invoice (Phase 9); waitlist-offer emails are sent directly (the notification outbox, retries and WhatsApp arrive in Phase 10); a capacity increase offers the new seats within 10 minutes via the job rather than instantly; the public seat count uses enrolments only (live holds aren't shown); Cloudinary `authenticated` document storage is written but untested here (no credentials; local disk was used); trial-to-enrolment conversion is Phase 7.
**Local test data left in the development database:** the "Mehta family" with dancer Aarav Mehta (enrolled in BOL-AND-01, three forms signed, photo release withdrawn, one private test document), the demo parent account and the family created when its family page was opened, the starting consent forms from the seed, and the Phase 5 test records.

## Phases 7–12
Tracked in [SPEC.md §12](SPEC.md#12-build-phases).
