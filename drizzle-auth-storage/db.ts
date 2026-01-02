import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { authData } from './auth-data'

// Get database URL from environment
const connectionString = process.env.DATABASE_URL || 'postgres://localhost:5432/borderland_oauth'

// Create postgres connection
const client = postgres(connectionString)

// Create drizzle instance
export const db = drizzle(client, {
  schema: { authData }
})

// Export schema for use in storage adapter
export const schema = { authData }

// Export drizzle-orm operators
export { eq, and, or, like, gt, isNull } from 'drizzle-orm'
