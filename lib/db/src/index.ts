import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

// En production → Neon (persistant 24/7)
// En développement → DB locale Replit
const isProduction = process.env.NODE_ENV === "production";
const connectionString = isProduction
  ? (process.env.NEON_DATABASE_URL || process.env.DATABASE_URL)
  : (process.env.DATABASE_URL || process.env.NEON_DATABASE_URL);

if (!connectionString) {
  throw new Error(
    isProduction
      ? "NEON_DATABASE_URL must be set in production. Configure it in Secrets."
      : "DATABASE_URL must be set. Did you forget to provision a database?"
  );
}

export const pool = new Pool({
  connectionString,
  ...(isProduction ? { ssl: { rejectUnauthorized: false } } : {}),
});
export const db = drizzle(pool, { schema });

export * from "./schema";
