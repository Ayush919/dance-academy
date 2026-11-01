# Architecture

How the code is organised and the rules every feature follows. Product scope lives in [SPEC.md](SPEC.md); data in [DATABASE.md](DATABASE.md).

## Layers

```
Page / Component ──► Server Action (defineAction) ──┐
Route Handler (defineRoute) ────────────────────────┤
                                                     ▼
                              Request context (AsyncLocalStorage)
                              academyId · actor · requestId · ip
                                                     │
                                                     ▼
                         Service ── authorize() ── domain logic ── recordAudit()
                                                     │
                                                     ▼
                         Mongoose model + tenantPlugin ──► MongoDB (replica set)
```

| Layer | Location | Rule |
|---|---|---|
| UI | `src/app`, `src/components` | Never imports models or services' internals. Calls Server Actions or reads through service functions in Server Components. |
| Boundaries | `src/server/lib/boundary.ts` | `defineAction` / `defineRoute` build the context, validate input with Zod, call **one** service, and return `{ ok, data } \| { ok: false, error }`. No business rules here. |
| Context | `src/server/context` | Built once per request from the session. Held in AsyncLocalStorage so models, audit and logs can read it. |
| Services | `src/server/services` | All business rules. Start with `authorize()`, run multi-document writes in `withTransaction()`, write an audit entry for every change. Throw `AppError` for expected failures. |
| Domain | `src/server/domain` | Pure functions (billing maths, schedule expansion, policy evaluation). No I/O; unit-tested exhaustively. |
| Models | `src/server/models` | Mongoose schemas with validation and indexes. Tenant-owned schemas use `tenantPlugin`. |

## Tenancy
Every business document carries `academyId`. The deployment serves one academy (`ACADEMY_SLUG`), but isolation is enforced as if it were multi-tenant:

- `tenantPlugin` adds `academyId` to every query, update, delete and aggregation, and stamps it on inserts.
- A query with **no context throws**; it never means "all academies".
- Saving a document that belongs to another academy throws. `bulkWrite` is refused because it would bypass the filters.
- `withSystemContext()` disables read filtering for seed scripts and cross-tenant jobs and is visible in logs and audit entries (`actorRole: system`).

**Gotcha:** Mongoose queries are lazy. A query built inside the context but awaited outside it would run without a context (and throw). The context helpers always `await` inside the scope; services should `await` their queries rather than returning them.

## Authorization
- `src/server/rbac/policy.ts` is the single table of roles → permissions → scope (`all`, `branch`, `assigned`, `own`).
- `authorize(permission, resource?)` is the only gate. It throws `UNAUTHENTICATED` / `FORBIDDEN`.
- `scopeFilter(permission, fields?)` returns the Mongo filter that limits a list to what the actor may see (their branches, their assigned classes, their household).
- UI hides what a role cannot do using the same policy, but only the server check is a security boundary.
- `tests/unit/rbac.test.ts` guards the table (e.g. guardians never get academy-wide personal data; only admins approve refunds).

## Authentication
Better Auth (`src/server/auth/auth.ts`) with the MongoDB adapter, sharing Mongoose's connection pool.
- Email + password (10–128 chars), scrypt hashing, password reset (30-minute single-use tokens, all sessions revoked), optional email verification (`REQUIRE_EMAIL_VERIFICATION`).
- Sessions: 7 days, refreshed daily, `HttpOnly; SameSite=Lax; Secure` (in production) cookies prefixed `remo.`.
- Privileged user fields (`role`, `academyId`, `branchIds`, `householdId`, `instructorId`, `studentId`, `status`) cannot be set at sign-up; a database hook forces safe values too.
- Suspended users cannot start sessions; existing sessions map to no actor.
- Built-in rate limits: sign-in 5/min, sign-up 5/10 min, reset 3/10 min per IP. Cross-origin auth requests are rejected.
- `src/proxy.ts` only redirects visitors without a session cookie away from `/admin` and `/portal`; it is not an authorization layer.

## Errors and responses
- Services throw `AppError(code, message, { fields, details })`. Codes map to HTTP statuses in `src/server/lib/errors.ts`.
- Zod errors become `VALIDATION` with field-level messages shaped for React Hook Form.
- Anything else is logged with the request ID and returned as a generic `INTERNAL` error; internals never leak.

## Transactions and consistency
- `withTransaction(fn)` runs `fn` in a snapshot / majority transaction. Mongoose picks up the session automatically. The driver retries transient conflicts, so `fn` must have no side effects outside the database (send notifications through the outbox, not directly).
- Sequences (`nextSequence`) increment inside the caller's transaction, so invoice and receipt numbers stay gap-free.
- Audit entries are written inside the same transaction as the change and are append-only (updates and deletes are refused at the model level; TTL keeps 3 years).

## Rate limiting
`hitRateLimit` / `enforceRateLimit` (`src/server/lib/rate-limit.ts`): fixed windows in MongoDB, one atomic upsert per hit, TTL cleanup. Presets for public forms, reads, analytics, exports and uploads.

## Caching (Next.js 16 Cache Components)
Cache Components are enabled. Public data uses `'use cache'` + `cacheTag` (e.g. `getSiteChrome()` tagged `site-chrome`, `branches`) inside `withPublicContext()`, an anonymous tenant-filtered context. Server Actions that change public data call `updateTag` (the editor sees the change on the next request); jobs and route handlers call `revalidateTag(tag, 'max')`.
Anything that reads the session or request headers sits behind a `<Suspense>` boundary. The admin and portal layouts set `export const instant = false` (they are per-user), and each page streams its data in its own boundary so navigation between pages stays instant. `getRequestContext()` is wrapped in React `cache()` so the layout and page share one session lookup.

## Scheduled jobs
Hosting is Vercel's free plan plus an external scheduler. Jobs live in `src/server/jobs/index.ts` and run per active academy through `POST /api/cron/[job]` behind a `CRON_SECRET` bearer token; every job is idempotent and safe to run late or twice.
- `generate-sessions` — daily (Vercel cron and GitHub Actions).
- `publish-scheduled` — every 10 minutes from `.github/workflows/cron.yml` (GitHub may run it a few minutes late), with a daily Vercel cron as a backstop.
- `waitlist-offers` — same schedule as `publish-scheduled`: offers freed seats and expires unanswered offers.
- `reconcile-seats` — daily: recomputes each batch's displayed enrolled count.

## Design systems
- One stylesheet (`src/app/globals.css`), two token sets: **Studio** at `:root` for the admin, **Stage** under `[data-theme="stage"]` for the public site and auth screens. `[data-surface="ivory"]` gives a warm light band inside Stage. shadcn/ui components read the same tokens, so they restyle automatically per surface.
- `--brand` / `--brand-foreground` are the only accent. The root layout sets them from Website → Brand (validated hex; the foreground is whichever of ink/ivory reaches 4.5:1), along with `data-fonts` for the font pairing.
- Typography utilities: `type-display` (condensed uppercase Archivo), `type-accent` (italic serif word), `type-eyebrow`; fluid sizes `text-display-{md,lg,xl,2xl}`.
- Motion lives in `src/components/motion`; `RevealLines` observes the unclipped wrapper (observing a masked line never fires).
- Admin pages: static `PageHeader` + data inside `<Suspense>` with a skeleton; lists use `parseListParams` → service → `DataTable`.
- Public sections live in `src/components/site/sections` and take plain content objects, so the CMS can render them from stored data.

## Scheduling
- Pure rules live in `src/server/domain/schedule.ts`; database work in `src/server/services/scheduling.ts`.
- Batches store weekly slots in branch-local time; `ClassSession` records exist ten weeks ahead (`generateSessions`, idempotent via the unique `{batchId, occurrenceKey}` index). Beyond that horizon the rules are the source of truth for clash checks.
- `checkConflicts` compares proposed intervals with other batches' occupied time (rules overridden by moved/cancelled session records), loose manual sessions, facility blocks and availability.
- Saves that change schedules call `lockScheduleResources` inside the transaction (bumps `scheduleVersion` on the room and instructors) so concurrent saves on shared resources serialise.

## Public website
- `src/server/services/public.ts` is the only data source for public pages: anonymous, tenant-filtered (`withPublicContext`), `'use cache'` with tags (`programs`, `batches`, `instructors`, `branches`, `events`, `gallery`, `testimonials`). Admin actions call `revalidateTag(tag, 'max')`.
- The catalogue is read once and filtered per request in pure functions (`public-filters.ts`), so filtered listings never hit the database.
- Public forms post to Server Actions with rate limits, a honeypot and a time trap.

## Website CMS
- **One schema drives everything.** `src/content/schema.ts` (client-safe) defines section types as field lists (`SECTION_DEFS`). The same definitions render the editor (`ContentFields`), validate with Zod (`DATA_SCHEMAS`) and check publish rules (`publishIssues`: required fields, alt text, safe links, WCAG contrast for the brand colour, `%s` in the title template). Adding a section type means one entry there plus a renderer in `src/components/site/section-renderer.tsx`.
- **Documents.** Pages, Navigation, Brand and SEO are `ContentDocument`s with a working draft and a published copy. Autosave sends the draft with the version it started from; a mismatch is a `CONFLICT` ("someone saved a newer version"), never a silent overwrite. "Also editing" is advisory presence, not a lock.
- **Publishing** runs in one transaction: immutable `ContentRevision`, published copy, audit entry. Restore copies a revision into the draft (history is never rewritten). Scheduling stores times; the `publish-scheduled` job publishes and takes down. Built-in pages (home, about, policies) can't be taken offline or renamed.
- **Reading.** `src/server/services/public-content.ts` reads the published copy with `'use cache'` and tags `content:page:<key>`, `content:pages`, `site-chrome`. Inside Draft Mode it returns the draft instead (Draft Mode bypasses the cache). `/api/preview` enables Draft Mode for signed-in editors only and redirects to a same-site path; the editor shows it in an iframe at phone, tablet and desktop widths.
- **Routing.** CMS pages render at `/[...slug]`; unknown paths check `redirects` before returning 404. Page slugs can't use reserved first segments (`RESERVED_SLUGS`).
- **Media.** Uploads are identified by magic bytes (SVG/HTML refused). Development stores files under `public/uploads`; production uploads directly to Cloudinary with a signed request, and the server verifies Cloudinary's response signature before registering the asset. Content stores URLs; usage lookups (`assetUsage`) block deleting files in use.
- **Gallery and testimonials** are plain collections (not documents): moderation and ordering act immediately and call `updateTag('gallery' | 'testimonials')`. Public stories from `/share-your-story` always land as pending.

## Families, consent and enrolment
- **People scope.** Households and students start with no branch. `peopleFilter` / `authorizePerson` (`src/server/services/people-scope.ts`) let branch staff see records in their branches *and* ones with no branch yet; guardians see their household, student logins see only themselves, instructors see students in their batches. Every list and every single-record read goes through them.
- **The seat engine** (`src/server/services/enrolment-core.ts`, rules in `src/server/domain/enrolment.ts`). Every seat decision runs in a transaction that first writes the batch (`seatVersion`), so two families racing for the last seat conflict and are retried one at a time. Free seats = capacity − (pending, active, paused enrolments) − (holds with `expiresAt > now`). Because expiry is a timestamp comparison, nothing needs cleaning up for the numbers to be right. Seats freed while people are waiting are *earmarked* for them: a newcomer can only take `free − waiting`.
- **Commit re-checks everything** (`commitEnrolment`): batch open and running, not ended, age on the start date, level, suspended student, signed current forms, required documents, fee plan, and that a seat really exists for this student (their own hold, or free-for-newcomers). The unique partial index backs up "one live enrolment per student per batch".
- **Waitlist.** `offerSeats` expires stale offers, then offers free seats in order (priority, then join time), creating a `waitlist_offer` hold for 24 h. It is idempotent, runs after any seat is freed and from the `waitlist-offers` job, and emails the family after the transaction commits (a failed email never undoes an offer). Accepting consumes the offer and creates the enrolment in one transaction.
- **Transfers and status changes** lock both batches in id order, write the new enrolment before ending the old one, record history, and re-run offers for the freed batch. `enrolledCount` on the batch is a display value recomputed from the enrolments on every change and nightly by `reconcile-seats`.
- **Consent.** Templates are versioned (`key` + `version`, one current per key). A signature is append-only and points at the exact version signed; revoking adds who/when/why but keeps the signature. Families with an unsigned or outdated current version are blocked from enrolling, and the admin lists flag them.
- **The media rule.** Gallery items and testimonials can tag students. `assertMediaConsent` refuses to publish or approve if any tagged student lacks a current, unrevoked media release covering that channel; revoking a media release hides every gallery item and un-approves every testimonial that tags the student, in the same transaction.
- **Student documents** are private. They are stored outside `public/` (development) or as Cloudinary `authenticated` assets (production), identified by content (PDF/JPEG/PNG/WebP/HEIC, 10 MB), listed per student, and only ever returned by `/api/documents/[id]` after `documents.read` is checked for that student. Responses are `private, no-store, nosniff` with a sandbox CSP; every view is audited.
- **Errors carry `details`.** `ApiError` can include facts the screen acts on (e.g. `missingConsents`, `canJoinWaitlist`). Services only put curated, non-sensitive data there.

## Server gotchas (learned the hard way)
- **Mongoose adds `updatedAt` to updates.** A pre-update hook that whitelists fields (like the consent revocation guard) must allow `updatedAt`, or every legitimate update is refused.
- **Don't call setState from an effect, even through a helper.** The React Compiler lint rule follows the call. Load data in event handlers, or on the server and pass it in.
- **Forms send raw input.** `useActionForm` validates on the client but sends `form.getValues()`; the server parses once. Sending parsed output would apply transforms twice (rupees→paise ×100).
- **No parallel operations inside a transaction.** MongoDB rejects concurrent operations on one session. Use `all()` from `src/server/db/concurrent.ts` instead of `Promise.all` in code that may run in a transaction.
- **Process-wide singletons.** Next.js can load a module once per server bundle. Anything that must be shared (the request-context store, the Mongo connection) lives on `globalThis`.
- **Register all models before use.** `src/server/models/index.ts` is imported by the connection module so `populate` never depends on import order.
- **Aggregates are already tenant-filtered.** The tenant plugin inserts `{ $match: { academyId: ObjectId } }` into every pipeline. Don't add your own `academyId` match with the string id from the request context: it matches nothing.
- **The previous route stays mounted.** With Cache Components, Next keeps the page you navigated away from alive in the background. Close dialogs before `router.push`, or they are still open when the user comes back.
- **Sortable lists need a stable id.** Give every dnd-kit `DndContext` an `id` from `useId()`; its default counter differs between server and client and causes hydration errors.

## Conventions
- TypeScript `strict` + `noUncheckedIndexedAccess`; no `any`.
- Money in integer minor units (paise). Times stored in UTC; schedules defined in the branch's IANA timezone.
- Register models with `defineModel('Name', () => model<Type>('Name', schema))`. Passing an untyped `Schema` to `model()` sends the TypeScript checker out of memory.
- Prettier: no semicolons, single quotes, 100 columns.
