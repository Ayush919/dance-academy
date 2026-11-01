# Dance Academy Platform — Product & Implementation Plan

> **Superseded by [SPEC.md](SPEC.md).** Kept for history only.

> Status: **Draft for approval** · Repository: empty (no commits) · Date: 2026-10-31
> Toolchain found: Node 22.23, npm 10.9, local `mongod`/`mongosh`, Docker.

This plan turns the brief into a product that a real academy owner would pay for. It keeps every requirement from the brief, re-orders the build so each phase ships something usable, and adds a small set of features that make the product stand out in the market. Where I made a call the brief left open, the reason is written next to it.

---

## 1. Product thesis: what makes this stand out

Most dance academy sites are a brochure plus a Google Form, and most "studio software" (Mindbody, Glofox, generic school ERPs) is a spreadsheet with a login. Owners live in WhatsApp, chase fees by hand, and lose trial students because nobody follows up. The product wins by doing three things well:

1. **A cinematic brand site that converts.** Built for one outcome: a visitor books a trial in under 60 seconds, from a phone, with seat counts that are real.
2. **An operations core that removes the daily grind.** Fees, attendance, batches, and follow-ups run from one place, with automatic reminders.
3. **Everything editable without a developer.** Every section, page, price, photo, and message template is controlled from the dashboard, with draft → preview → publish.

### Differentiators (beyond the brief)

| Feature | Why it matters | Phase |
|---|---|---|
| **Class Finder** — 4-question match (age, level, goal, branch/time) → recommended batches with live seats | Converts better than filter grids for first-time visitors; feeds the CRM with intent data | 6 |
| **Real scarcity** — "3 spots left", waitlist when full, auto-offer when a seat frees | Urgency that is true, plus no lost demand on full batches | 6 |
| **Family accounts** — one guardian, many children, one bill | Most students at Indian academies are minors; parents pay and book | 7 |
| **Make-up classes** — a missed class can be booked into another batch of the same level | A top pain point for parents and a reason to choose one academy over another | 7 |
| **QR check-in + one-tap roster** for instructors on a phone (installable PWA) | Attendance in 20 seconds; no paper registers | 7 |
| **Fee engine without a gateway** — invoices, partial payments, UPI/cash/bank recording, GST-ready receipts, dues ageing, one-click WhatsApp reminder | Solves fee chasing today; a gateway plugs in later without schema changes | 8 |
| **Verifiable certificates** — PDF with QR to a public `/verify/:code` page | Students share them on Instagram, which is free marketing | 8 |
| **Section-level visitor analytics** — first-party, cookieless, region + funnel (visit → program → trial → enrolment) | Owner sees which sections and programs drive bookings; no consent banner needed | 10 |
| **⌘K command palette** in admin — jump to any student, lead, batch, invoice | Makes the dashboard feel fast and professional | 3 |
| **WhatsApp-native workflow** — click-to-chat with prefilled templates now, API provider adapter ready | Works on day one with zero setup; upgrades to automated sends later | 9 |

---

## 2. Decisions I made (and why)

| Area | Decision | Reason |
|---|---|---|
| Framework | **Next.js 16** (App Router, Turbopack, `proxy.ts`), React 19, TypeScript strict | Current stable. Server Components for public pages, Server Actions for admin forms. |
| Auth | **Better Auth 1.7** (MongoDB adapter, email+password, password reset, email verification, sessions in HTTP-only cookies, built-in rate limiting) | Auth.js v5 is still in beta (`5.0.0-beta.32`) and the Auth.js project is now maintained by the Better Auth team. Better Auth is stable and covers everything the brief asks for. |
| Database | MongoDB Atlas + **Mongoose 9** | As specified. Transactions need a replica set: Atlas has one; locally we run `mongod` as a single-node replica set (documented). |
| Styling | Tailwind CSS 4 + shadcn/ui (two themes: public "Stage", admin "Studio") | One component base, two design systems via CSS variables. |
| Animation | **Motion** (the package formerly called Framer Motion) | Same API, current package name. All animation respects `prefers-reduced-motion`. |
| Forms | React Hook Form + **Zod 4**; the same Zod schema validates on the client and in the service layer | One source of truth for validation. |
| Charts | Recharts 3 | As specified. |
| Rich text | Tiptap 3, stored as **JSON, never raw HTML**, rendered through an allow-list | Removes the XSS risk that HTML-in-CMS creates. |
| Media | Cloudinary signed uploads (server signs, browser uploads directly) with a local-disk adapter for development | Keeps secrets on the server; works without credentials in dev. |
| Email | Resend adapter + SMTP adapter + "log" adapter for dev | Provider-swappable; safe test mode. |
| WhatsApp | Provider interface (Meta Cloud API / Twilio / Interakt-style) + "log" adapter; click-to-chat links work with no provider | "Integration-ready" as requested. |
| PDFs | `@react-pdf/renderer` for receipts, invoices, certificates | Server-side, no headless browser needed. |
| Time | Store UTC; each branch has an IANA timezone; `date-fns` + `@date-fns/tz` | Correct schedules across branches and DST. |
| Money | Integer minor units (paise) + ISO currency code; default **INR**, configurable | No floating-point errors in fee totals. |
| Tenancy | Every document carries `academyId`; deploy single-tenant | Cheap now, and the product can become multi-academy SaaS later without a migration. |
| Rate limiting | MongoDB fixed-window limiter (TTL index) behind an interface; Upstash adapter optional | No extra infrastructure required. |
| Bot protection | Honeypot + time-trap on public forms; optional Cloudflare Turnstile if keys are set | Stops spam on trial and contact forms. |
| Payments gateway | **Not built.** Manual payment management only, with a `provider` field and a `PaymentGateway` interface reserved for Razorpay later | As instructed. |
| Testing | Vitest (services, with an in-memory replica set) + Playwright (critical end-to-end flows) | Business rules are tested where they live. |
| Hosting | Vercel + Atlas + Cloudinary + Resend; Vercel Cron for reminders. Dockerfile as an alternative | Simplest production path. |

---

## 3. Design direction

### Public site — "Stage"
A dark, cinematic, editorial look, like a performance brand rather than a school.

- **Canvas:** near-black stage `#0B0B0C`, layered surfaces `#141416` / `#1C1C1F`, warm white text `#F5F2EC`, muted text at ~60% opacity.
- **One accent:** spotlight vermillion `#FF4A2B` (configurable from Brand Settings). Used for CTAs, active states and small highlights only. No rainbow program colours.
- **Type:** *Archivo* variable (uses its width axis: condensed, uppercase display headlines at 96–180px) paired with *Instrument Serif* italic for single emotive words ("move *freely*"). Body in *Inter*. All via `next/font`, self-hosted, zero layout shift.
- **Layout:** asymmetric editorial grids, full-bleed video and photography, large negative space, marquee-style program names, numbered sections. Cards are used only where content really is a list (events, instructors); other sections use split layouts, sticky media, and horizontal scroll to avoid the "repeated card grid" look.
- **Glass:** used in exactly two places — the floating header over the hero video, and the booking sheet over imagery. Anything more reads as dated.
- **Motion:** slow reveal on scroll, a subtle parallax on hero media, magnetic primary CTA, page transitions. All off under reduced motion; the hero video swaps to a poster image on slow connections and reduced motion.
- **Light sections:** one or two warm off-white sections (testimonials, final CTA) to give rhythm on long pages.

### Admin — "Studio"
- Neutral light workspace, dark collapsible sidebar, the same accent used sparingly for primary actions.
- Dense but readable data tables (TanStack Table under shadcn), filters as chips, column visibility, saved views, CSV export.
- Drawers for quick edits, modals only for confirmations, toasts for feedback.
- Every page has loading skeletons, empty states with a next action, error boundaries, and confirm dialogs for destructive actions.
- Mobile: sidebar becomes a sheet; tables become stacked rows; instructor screens are designed phone-first.

---

## 4. Architecture

### 4.1 Application layout

```
src/
  app/
    (site)/                 public website (Server Components, cached)
      page.tsx              homepage built from CMS sections
      programs/ [slug]/     listing + SEO detail pages
      classes/ events/ [slug]/ gallery/ instructors/ [slug]/
      about/ contact/ book-trial/ find-your-class/
      [...slug]/            CMS-created pages and campaign landing pages
      verify/[code]/        public certificate verification
    (auth)/                 login, register, forgot/reset password, verify email
    portal/                 student & guardian portal
    admin/                  staff workspace (permission-filtered per role)
    api/
      auth/[...all]/        Better Auth handler
      v1/                   public JSON: availability, slots, class finder
      t/                    analytics beacon
      uploads/sign/         signed upload parameters
      exports/[resource]/   CSV streams (permission-checked)
      cron/[job]/           reminders, session generation, rollups (secret-protected)
    sitemap.ts robots.ts opengraph-image.tsx
  proxy.ts                  coarse route gating (real checks happen on the server)
  server/
    db/                     connection, transaction helper, counters
    models/                 Mongoose schemas
    services/               business logic (one file per domain)
    validators/             Zod schemas shared with forms
    auth/                   Better Auth config, session helpers
    rbac/                   roles, permissions, scope checks
    actions/                thin Server Actions → services
    notifications/          channels, templates, outbox
    integrations/           cloudinary, email, whatsapp, maps, (gateway placeholder)
    lib/                    errors, result type, pagination, money, time, slugs
  components/
    ui/                     shadcn primitives
    site/                   Stage design system + section renderers
    admin/                  Studio design system, DataTable, forms, charts
    portal/
  hooks/ styles/ types/
scripts/seed.ts             demo data
tests/unit/ tests/e2e/
docs/                       architecture, database, API, setup, deploy, testing, checklist
```

### 4.2 Request flow and rules
- **Component → Server Action / Route Handler → Service → Model.** Components never touch models; route handlers and actions only parse input, call one service, and map the result.
- Every service function takes an `actor` (session context) and calls `authorize(actor, permission, scope)` first. The UI hides what a role cannot do, but that is never the security boundary.
- Services return a typed `Result`; one error type maps to HTTP status codes and form errors. API responses use one shape: `{ ok, data, error, meta }`.
- Every create/update/delete writes an `AuditLog` entry (who, what, before/after diff, IP).
- Public pages are cached with tags (`programs`, `events`, `site-settings`, `page:<slug>` …); publishing in the CMS calls `revalidateTag`, so changes appear in seconds without rebuilding.

### 4.3 Roles and permissions

Permissions are strings (`students.read`, `payments.record`, `cms.publish` …). Roles are bundles of permissions plus a **scope** (all branches, or a list of branch IDs). Checks run on the server for every action.

| Capability | Super Admin | Academy Admin | Branch Manager | Instructor | Receptionist | Student / Guardian |
|---|---|---|---|---|---|---|
| Website CMS, brand, SEO, navigation | ✅ | ✅ | — | — | — | — |
| Branches, academy settings, users & roles | ✅ | ✅ (no Super Admin edits) | — | — | — | — |
| Programs | ✅ | ✅ | view | view (own) | view | public |
| Batches, schedules, rooms | ✅ | ✅ | ✅ own branch | view own | view | own |
| Students & guardians | ✅ | ✅ | ✅ own branch | roster of own batches | create/view | self/children |
| Enrolments | ✅ | ✅ | ✅ own branch | — | create pending | request |
| Attendance | ✅ | ✅ | ✅ own branch | ✅ own batches | view | own |
| Invoices, payments, refunds | ✅ | ✅ | record; refunds need approval | — | record payment | own |
| Leads, trials, inquiries | ✅ | ✅ | ✅ own branch | — | ✅ | own bookings |
| Events | ✅ | ✅ | ✅ own branch | view | registrations | register |
| Marketing, coupons, templates | ✅ | ✅ | — | — | — | — |
| Reports & analytics | ✅ | ✅ | own branch | own classes | — | — |
| Audit log | ✅ | ✅ | — | — | — | — |

Instructors and receptionists use the same `/admin` shell with a reduced menu. Instructor screens are optimised for phones.

---

## 5. Data model

The brief's 24 models are all kept. I add nine because the workflows need them; the reason is listed for each.

**Identity & org:** `User` (Better Auth; holds role + branch scope), `StudentProfile` (student details; links to a guardian `User`), `Instructor`, `Academy`, `Branch`, **`Room`** *(added: needed to prevent room double-booking)*.

**Catalogue & schedule:** `Program`, `Batch` (weekly schedule rules, capacity, `enrolledCount`, price plan), **`ClassSession`** *(added: each dated occurrence of a batch, so single classes can be cancelled, rescheduled, and have attendance)*, **`TrialSlot`** *(added: bookable trial capacity per date/time)*.

**Operations:** `Enrollment`, **`Waitlist`** *(added: full batches)*, `TrialBooking`, `Attendance`, `Membership`, **`Invoice`** *(added: what is owed — outstanding balances cannot be computed reliably from payments alone)*, `Payment` (money received or refunded, linked to an invoice), `Coupon`, **`Certificate`** *(added: verifiable certificates)*.

**Events:** `Event`, `EventRegistration`.

**CRM & marketing:** `Lead` (status pipeline, owner, source, next follow-up), **`LeadActivity`** *(added: timeline of notes/calls so `Lead` stays small)*, `ContactInquiry`, `Subscriber` (newsletter), `Campaign`/banners stored in `WebsiteSettings` or `WebsitePage` as appropriate.

**Content:** `WebsitePage` (ordered, typed sections; draft + published versions; SEO), `WebsiteSettings` (brand, contact, SEO defaults, policies, integrations), `Navigation`, `Testimonial`, `GalleryItem`, **`MediaAsset`** *(added: one media library reused by every section)*.

**System:** `Notification` (one per recipient per channel, with delivery status — doubles as the outbox), `NotificationTemplate`, `AuditLog`, **`Counter`** *(added: gap-free receipt/invoice numbers)*, `AnalyticsEvent` (raw, 90-day TTL) + `AnalyticsDaily` (rollups), `RateLimit` (TTL).

### Integrity rules (the parts that usually break)
- **Capacity:** a seat is taken with one atomic conditional update — `Batch.findOneAndUpdate({ _id, enrolledCount: { $lt: capacity } }, { $inc: { enrolledCount: 1 } })` — inside a transaction that also creates the `Enrollment`. If the update matches nothing, the batch is full and the student is offered the waitlist. The same pattern guards trial slots and event tickets.
- **No duplicates:** partial unique indexes, e.g. one active enrolment per student per batch; one trial booking per phone per program per day; one event registration per user per event; unique slugs per academy.
- **Scheduling conflicts:** when a batch or session is saved, the service checks overlapping time ranges for the same instructor and the same room across overlapping date ranges, in the branch's timezone, and rejects with a clear message naming the conflict.
- **Money:** invoice totals are derived from line items, discounts and tax; `amountPaid` and `balance` are updated in the same transaction that records a payment. Refunds are negative payments linked to the original and need a reason.
- **Counts on dashboards** are always computed from data (aggregations or rollups refreshed by cron), never stored by hand.

The full relationship document (diagram + every field and index) is a Phase 1 deliverable: `docs/DATABASE.md`.

---

## 6. Key workflows

1. **Trial booking:** program → branch → date/slot (only real, available slots) → details (guardian fields appear for minors) → confirm. Creates `TrialBooking` + `Lead` (status *Trial Booked*), sends confirmation with calendar file and WhatsApp link, schedules reminders 24h and 2h before. Staff can approve, reject, reschedule, cancel, mark attended/no-show, and **convert to enrolment** in one step, which carries the lead's data into a student profile.
2. **Enrolment:** student (or staff) picks a batch → pending → staff approves → seat taken atomically → first invoice generated from the price plan → welcome notification. Batch transfer moves the seat in one transaction.
3. **Fees (manual):** invoices are generated per billing cycle (monthly or course-based) → staff records payment (cash/UPI/bank/card/cheque, reference, date) → balance updates → numbered PDF receipt → notification. Overdue invoices age into 0–30/31–60/60+ buckets; reminders go out automatically or with one click.
4. **Attendance:** sessions are generated 8 weeks ahead from batch rules → instructor opens today's session on a phone → one-tap present/late/absent or QR scan → percentages update → students under a configurable threshold are flagged.
5. **CMS publishing:** edit sections in a form-based editor with live preview (Next.js draft mode) → save draft → preview at the real URL → publish (creates a revision; rollback available) → cache revalidated.
6. **Lead pipeline:** every public form creates or updates a lead (matched by phone/email) with its source → board and table views → assign owner, notes, next follow-up date → overdue follow-ups appear on the dashboard.

---

## 7. Phased build plan

Each phase ends with the same gate: `typecheck` and `lint` clean, production `build` passes, unit/e2e tests for that phase pass, a visual check at 375 / 768 / 1440 px in the browser, and `docs/CHECKLIST.md` updated with what is done and what is left. Nothing is marked complete without being run.

I re-ordered the brief's phases slightly: the data layer and auth come first so that the public site is database-driven from day one (no hardcoded content to rip out later), and the CMS editor follows straight after the public site because it is the brief's most important requirement.

| # | Phase | Delivers | Brief phases |
|---|---|---|---|
| 1 | **Foundation** | Next.js 16 scaffold, strict TS, lint/format, env validation, Mongo connection + transaction helper, all core models + indexes, Better Auth, RBAC, audit logging, rate limiter, error/result types, seed skeleton, `docs/ARCHITECTURE.md`, `docs/DATABASE.md` | 1, 4 |
| 2 | **Design systems** | Stage + Studio tokens, typography, motion presets, shadcn base, public layout (header, footer, sections kit), admin shell (sidebar, top bar, breadcrumbs, ⌘K, notifications, profile menu), DataTable, form kit, empty/error/loading patterns | 2 |
| 3 | **Academy core (admin)** | Branches, rooms, programs, instructors (with availability), batches with weekly schedules + conflict detection, session generation, timetable view | 6 (part) |
| 4 | **Public website** | Homepage from CMS sections, About, Programs (search/filters/sort/pagination) + detail, Classes & batches with live seats, Instructors, Events + detail, Gallery with lightbox/video, Testimonials, Contact with Maps + FAQ; metadata, sitemap, robots, OG images, JSON-LD | 3 |
| 5 | **Website CMS** | Homepage section builder (edit, reorder, enable/disable, preview, publish, revisions), page manager, navigation editor, brand & SEO settings, media library with signed uploads, testimonial moderation, gallery management, policies | 5 |
| 6 | **Conversion engine** | Trial booking flow + trial slot management, Class Finder, waitlist, contact & inquiry capture, Lead CRM (pipeline, assignments, follow-ups, activities), trial-to-enrolment conversion | 8 (part) |
| 7 | **Students, enrolment & attendance** | Registration, guardian/family accounts, student management (search, filters, notes, suspend, export), enrolment workflow, batch transfers, make-up classes, instructor portal (PWA), QR + roster attendance, attendance reports, student portal (profile, classes, bookings, attendance, notifications) | 4, 6 |
| 8 | **Fees & revenue** | Price plans, invoices, manual payment recording, receipts (PDF), refunds with approval, memberships + expiry, coupons, referral credits, outstanding/ageing, event ticket payments, certificates + verify page, portal payments view | 7 |
| 9 | **Marketing & notifications** | Announcement/promo banners, campaign landing pages, newsletter, WhatsApp CTA config, notification templates, email + in-app + WhatsApp adapters, outbox processor, cron reminders (class, trial, dues, event, membership expiry) | 8 (part) |
| 10 | **Analytics & reports** | Live overview dashboard, visitor analytics (pages, sections, region, funnel), reports for enrolment, revenue, payments, attendance, trial conversion, program popularity, instructor and branch performance, lead conversion — all with date filters + CSV | 7.1, 7.15 |
| 11 | **Hardening & launch** | Full demo seed, Playwright suite for critical flows, security review (RBAC denial tests, upload checks, headers/CSP), Lighthouse pass, docs (setup, API, deploy, testing, checklist), Vercel + Atlas deployment guide, Dockerfile | 9 |

Phases 3 and 4 can overlap; everything else runs in order because each phase uses the one before.

---

## 8. Security checklist (built in, not bolted on)
- Passwords hashed by Better Auth (scrypt); sessions in HTTP-only, `Secure`, `SameSite=Lax` cookies; session revocation on suspend/role change.
- Server-side `authorize()` in every service; branch scoping applied in queries, not after them.
- Zod validation on every input; Mongo query objects built from validated values only (no operator injection).
- Server Actions get Next.js origin checks; route handlers that change state verify origin + session.
- Rich text as JSON with an allow-list renderer; user text escaped by React; strict Content-Security-Policy and security headers.
- Uploads: server-signed, folder-restricted, type and size limits, images re-encoded by Cloudinary.
- Rate limits on login, registration, password reset, and all public forms; honeypot + optional Turnstile.
- Secrets only in server env; `env.ts` validates at boot and fails fast; no secret ever reaches a client bundle.
- Audit log for every mutation; demo admin created only by the seed script from env values, never hardcoded.
- Student data access limited to the student, their guardian, and staff with scope over their branch.

## 9. Performance & SEO
- Public pages are Server Components, statically rendered and tag-revalidated; client JS only for interactive islands (booking sheet, filters, lightbox).
- `next/image` with Cloudinary loader (AVIF/WebP, responsive sizes, blur placeholders); hero video served as adaptive MP4/WebM with poster, lazy-loaded below the fold.
- Targets: LCP < 2.0s on 4G mobile, CLS < 0.05, INP < 200ms, Lighthouse ≥ 95 on public pages.
- Per-page metadata from CMS, canonical URLs, dynamic sitemap, robots, generated OG images, JSON-LD (`DanceSchool`/`LocalBusiness` per branch, `Course` per program, `Event` per event, `FAQPage`).

---

## 10. Open questions for you

1. **Brand:** is this for a specific academy (name, logo, photos), or should I seed a fictional demo brand? My default: a demo brand called **"MOTIF Dance Company"** with 2 branches, fully replaceable from Brand Settings.
2. **Market:** I am assuming India — INR, GST fields on receipts, WhatsApp-first, Razorpay later. Correct?
3. **Visual direction:** dark cinematic "Stage" with a single vermillion accent (section 3). Happy with this, or would you prefer a lighter, more premium-editorial look?
4. **Media:** do you have real photos/videos? If not, I will use licensed stock placeholders that are easy to swap.
5. **Accounts for services:** for local development I need nothing (dev adapters). For a live demo: MongoDB Atlas URI, Cloudinary, Resend, Google Maps API key.

---

## 11. Honest scope note
This is a large product — comparable to a commercial studio-management SaaS plus a custom brand site. Built properly it is many sessions of work. I will deliver it phase by phase, each one running, tested and documented, rather than generating everything at once and leaving half of it unverified.
