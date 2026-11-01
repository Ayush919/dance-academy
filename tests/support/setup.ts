import { inject } from 'vitest'

/** Give each test file its own database on the shared replica set. */
const base = new URL(inject('mongoUri'))
base.pathname = `/remo_test_${process.pid}_${Math.random().toString(36).slice(2, 8)}`

Object.assign(process.env, {
  NODE_ENV: 'test',
  MONGODB_URI: base.toString(),
  APP_URL: 'http://localhost:3000',
  ACADEMY_SLUG: 'remo-test',
  BETTER_AUTH_SECRET: 'test-secret-test-secret-test-secret-0123456789',
})
