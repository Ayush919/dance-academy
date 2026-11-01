# Local setup

## Requirements
- Node.js 22+
- MongoDB 6+ binaries (`mongod`, `mongosh`) — e.g. `brew install mongodb-community`

## 1. Install
```bash
npm install
```

## 2. Start a local replica set
Transactions (enrolment, payments, numbering) need a replica set, even locally. This starts a single-node one on port **27018** with data in `./.data` (git-ignored), so it never collides with another MongoDB on 27017.
```bash
npm run db:dev
```
Stop it with `npm run db:stop`.

## 3. Configure environment
```bash
cp .env.example .env.local
```
Fill in at least:
- `BETTER_AUTH_SECRET` — `openssl rand -base64 48`
- `CRON_SECRET` — `openssl rand -hex 32`
- `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` (12+ characters)
- Optional, local only: `SEED_GUARDIAN_EMAIL`, `SEED_GUARDIAN_PASSWORD` for a demo parent. The seed does not create it; sign it up at `/register` (or `POST /api/auth/sign-up/email`) to try the family portal.

Email, Cloudinary, Maps and Turnstile keys are optional in development: emails are written to the server log instead of being sent.

## 4. Seed demo data
```bash
npm run seed
```
Creates the academy **Remo Dance Company**, branches (Andheri West, Mumbai; Koregaon Park, Pune) with rooms, the super admin from your `SEED_*` values, and a demo catalogue: fee plans, fictional instructors, programs and active batches with ten weeks of classes. Safe to re-run; it never resets an existing admin's password. It refuses to run against a non-local database unless `SEED_ALLOW_REMOTE=true`.

## 5. Run
```bash
npm run dev
```
Open http://localhost:3000. Health check: http://localhost:3000/api/health.

## Scheduled jobs
Jobs run at `POST /api/cron/<job>` with `Authorization: Bearer $CRON_SECRET`. Locally:
```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/generate-sessions
```
In production, `vercel.json` runs `generate-sessions` daily; `.github/workflows/cron.yml` is a fallback (set `APP_URL` and `CRON_SECRET` repository secrets). Jobs are idempotent.

## Checks
| Command | What it does |
|---|---|
| `npm run typecheck` | Generates route types, then strict TypeScript check |
| `npm run lint` | ESLint (Next.js core-web-vitals + TypeScript rules) |
| `npm test` | Unit + integration tests (starts an in-memory replica set) |
| `TEST_MONGODB_URI="mongodb://127.0.0.1:27018/?replicaSet=rs0" npm test` | Same, against the local replica set (faster; each test file uses a throwaway database) |
| `npm run build` | Production build |
