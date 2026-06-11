import Database from "@tauri-apps/plugin-sql";
import {
  MIGRATION_STATEMENTS,
  SCHEMA_STATEMENTS,
  SEED_STATEMENTS,
} from "./schema";

let dbPromise: Promise<Database> | null = null;

/**
 * Returns a singleton SQLite connection, creating the schema on first load.
 * The DB file lives in the app's data directory as `mochi.db`.
 */
export function getDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await Database.load("sqlite:mochi.db");
      await initSchema(db);
      return db;
    })();
  }
  return dbPromise;
}

async function initSchema(db: Database): Promise<void> {
  // pragmas
  await db.execute("PRAGMA journal_mode = WAL;");
  await db.execute("PRAGMA foreign_keys = ON;");

  for (const stmt of SCHEMA_STATEMENTS) {
    await db.execute(stmt);
  }
  // Migrations for pre-existing DBs: ignore "duplicate column" on re-run.
  for (const stmt of MIGRATION_STATEMENTS) {
    try {
      await db.execute(stmt);
    } catch {
      // column already exists — expected, safe to ignore.
    }
  }
  for (const stmt of SEED_STATEMENTS) {
    await db.execute(stmt);
  }
}

/** Convenience helpers so services don't repeat getDb() boilerplate. */
export async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const db = await getDb();
  return db.select<T[]>(sql, params);
}

export async function execute(
  sql: string,
  params: unknown[] = [],
): Promise<{ rowsAffected: number; lastInsertId: number }> {
  const db = await getDb();
  const res = await db.execute(sql, params);
  return { rowsAffected: res.rowsAffected, lastInsertId: res.lastInsertId ?? 0 };
}
