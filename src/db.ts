import pg from "pg";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Example: postgres://openmemory:openmemory@localhost:5432/openmemory"
  );
}

export const pool = new Pool({ connectionString });

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Applies sql/schema.sql. Safe to call on every boot — statements are idempotent. */
export async function ensureSchema(): Promise<void> {
  const schemaPath = join(__dirname, "..", "sql", "schema.sql");
  const schema = readFileSync(schemaPath, "utf8");
  await pool.query(schema);
}

export async function ensureProject(projectId: string): Promise<void> {
  await pool.query(
    `INSERT INTO projects (id) VALUES ($1) ON CONFLICT (id) DO NOTHING`,
    [projectId]
  );
}
