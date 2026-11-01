import 'server-only'
import { betterAuth } from 'better-auth'
import { mongodbAdapter } from 'better-auth/adapters/mongodb'
import { nextCookies } from 'better-auth/next-js'
import { ObjectId } from 'mongodb'
import { env } from '@/server/env'
import { getMongoClient } from '@/server/db/connect'
import { getDeploymentAcademyId } from '@/server/services/academy-resolver'
import { sendEmail } from '@/server/integrations/email'
import { authEmails } from './emails'

export const AUTH_COOKIE_PREFIX = 'remo'

const client = getMongoClient()
const config = env()

export const auth = betterAuth({
  appName: 'Remo Dance Company',
  baseURL: config.APP_URL,
  secret: config.BETTER_AUTH_SECRET,
  trustedOrigins: [config.APP_URL],
  database: mongodbAdapter(client.db(), { client, usePlural: true }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    requireEmailVerification: config.REQUIRE_EMAIL_VERIFICATION,
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: 60 * 30,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({ to: user.email, ...authEmails.resetPassword(user.name, url) })
    },
  },
  emailVerification: {
    sendOnSignUp: config.REQUIRE_EMAIL_VERIFICATION,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({ to: user.email, ...authEmails.verifyEmail(user.name, url) })
    },
  },

  user: {
    additionalFields: {
      // `input: false` — none of these can be set by the person signing up.
      role: { type: 'string', required: false, defaultValue: 'guardian', input: false },
      academyId: { type: 'string', required: false, input: false },
      branchIds: { type: 'string[]', required: false, defaultValue: [], input: false },
      householdId: { type: 'string', required: false, input: false },
      instructorId: { type: 'string', required: false, input: false },
      studentId: { type: 'string', required: false, input: false },
      status: { type: 'string', required: false, defaultValue: 'active', input: false },
      phone: { type: 'string', required: false, input: true },
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    freshAge: 60 * 15,
  },

  rateLimit: {
    enabled: true,
    storage: 'database',
    window: 60,
    max: 100,
    customRules: {
      '/sign-in/email': { window: 60, max: 5 },
      '/sign-up/email': { window: 60 * 10, max: 5 },
      '/request-password-reset': { window: 60 * 10, max: 3 },
      '/reset-password': { window: 60 * 10, max: 5 },
      '/send-verification-email': { window: 60 * 10, max: 3 },
    },
  },

  advanced: {
    cookiePrefix: AUTH_COOKIE_PREFIX,
    useSecureCookies: config.NODE_ENV === 'production',
    defaultCookieAttributes: { httpOnly: true, sameSite: 'lax' },
  },

  databaseHooks: {
    user: {
      create: {
        // Public sign-ups always become guardians of this deployment's academy.
        // Privileged fields are forced here as well as being non-input fields (defence in depth).
        before: async (user) => ({
          data: {
            ...user,
            academyId: await getDeploymentAcademyId(),
            role: 'guardian',
            status: 'active',
            branchIds: [],
            householdId: undefined,
            instructorId: undefined,
            studentId: undefined,
          },
        }),
      },
    },
    session: {
      create: {
        // Suspended accounts cannot start a session.
        before: async (session) => {
          const user = await client
            .db()
            .collection('users')
            .findOne({ _id: new ObjectId(session.userId) }, { projection: { status: 1 } })
          if (user?.status === 'suspended') return false
        },
      },
    },
  },

  plugins: [nextCookies()],
})

export type Auth = typeof auth
export type AuthSession = typeof auth.$Infer.Session
