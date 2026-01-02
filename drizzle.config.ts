import type { Config } from 'drizzle-kit'

export default {
  schema: './drizzle-auth-storage/auth-data.ts',
  out: './drizzle-auth-storage/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgres://localhost:5432/borderland_oauth'
  }
} satisfies Config
