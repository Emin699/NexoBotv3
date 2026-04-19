import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

// Priorité : si NEON_DATABASE_URL est défini (explicitement configuré), on l'utilise toujours.
// Sinon, en production on prend DATABASE_URL, en dev on prend DATABASE_URL (DB locale Replit).
const neonUrl = process.env.NEON_DATABASE_URL;
const localUrl = process.env.DATABASE_URL;

const connectionString = neonUrl || localUrl;
const useNeon = !!neonUrl;

if (!connectionString) {
  throw new Error(
    "Aucune base de données configurée. Définissez NEON_DATABASE_URL ou DATABASE_URL."
  );
}

export const pool = new Pool({
  connectionString,
  ...(useNeon ? { ssl: { rejectUnauthorized: false } } : {}),
});
export const db = drizzle(pool, { schema });

export * from "./schema";
