import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync, type SQLInputValue, type StatementSync } from "node:sqlite";
import { type ServerFeature, serverFeatures } from "./features.server";

// ---------- migrations ----------

/** A schema change with a globally unique id ("base/001-initial", "<feature id>/<name>"). */
export type Migration = { id: string; up: (db: DatabaseSync) => void };

export const NOW = "(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))";

/** The base schema. To change it, APPEND a migration and never edit one that has shipped. */
export const BASE_MIGRATIONS: Migration[] = [
  {
    id: "base/001-initial",
    up: (db) =>
      db.exec(`
        CREATE TABLE routines (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          description TEXT,
          created_at TEXT NOT NULL DEFAULT ${NOW},
          updated_at TEXT NOT NULL DEFAULT ${NOW}
        );

        CREATE TABLE routine_exercises (
          routine_id INTEGER NOT NULL REFERENCES routines (id) ON DELETE CASCADE,
          position INTEGER NOT NULL,
          exercise_id TEXT NOT NULL,
          sets INTEGER NOT NULL CHECK (sets BETWEEN 1 AND 20),
          reps INTEGER CHECK (reps BETWEEN 1 AND 1000),
          note TEXT,
          PRIMARY KEY (routine_id, position)
        );

        CREATE TABLE workouts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          routine_id INTEGER REFERENCES routines (id) ON DELETE SET NULL,
          started_at TEXT NOT NULL,
          finished_at TEXT CHECK (finished_at IS NULL OR finished_at >= started_at),
          note TEXT,
          created_at TEXT NOT NULL DEFAULT ${NOW},
          updated_at TEXT NOT NULL DEFAULT ${NOW}
        );
        CREATE INDEX workouts_started ON workouts (started_at);
        -- At most one workout in progress.
        CREATE UNIQUE INDEX workouts_one_active ON workouts ((finished_at IS NULL)) WHERE finished_at IS NULL;

        CREATE TABLE workout_exercises (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          workout_id INTEGER NOT NULL REFERENCES workouts (id) ON DELETE CASCADE,
          position INTEGER NOT NULL,
          exercise_id TEXT NOT NULL,
          note TEXT
        );
        CREATE INDEX workout_exercises_workout ON workout_exercises (workout_id, position);
        CREATE INDEX workout_exercises_exercise ON workout_exercises (exercise_id);

        CREATE TABLE workout_sets (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          workout_exercise_id INTEGER NOT NULL REFERENCES workout_exercises (id) ON DELETE CASCADE,
          position INTEGER NOT NULL,
          kind TEXT NOT NULL DEFAULT 'working' CHECK (kind IN ('warmup', 'working')),
          weight_kg REAL CHECK (weight_kg >= 0),
          reps INTEGER CHECK (reps >= 0),
          duration_s INTEGER CHECK (duration_s >= 0),
          distance_m REAL CHECK (distance_m >= 0),
          completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1))
        );
        CREATE INDEX workout_sets_line ON workout_sets (workout_exercise_id, position);

        CREATE TABLE settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
      `),
  },
];

/** Base migrations first, then each feature's, in feature-id order. */
export function allMigrations(features: ServerFeature[] = serverFeatures()): Migration[] {
  const out = [...BASE_MIGRATIONS];
  for (const f of features) {
    for (const m of f.migrations ?? []) out.push({ id: `${f.id}/${m.name}`, up: m.up });
  }
  const ids = out.map((m) => m.id);
  const dupe = ids.find((id, i) => ids.indexOf(id) !== i);
  if (dupe) throw new Error(`Duplicate migration "${dupe}"`);
  return out;
}

/** Ids of the migrations already applied to `db`. */
export function appliedMigrations(db: DatabaseSync): string[] {
  db.exec(`CREATE TABLE IF NOT EXISTS _migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT ${NOW})`);
  return (db.prepare("SELECT id FROM _migrations ORDER BY rowid").all() as { id: string }[]).map((r) => r.id);
}

/**
 * Apply every migration not yet recorded in `_migrations`, each in its own transaction. Tracking by id (not by
 * count) lets features add migrations independently of each other. Safe to call on every startup.
 */
export function migrate(db: DatabaseSync, migrations: Migration[] = allMigrations()): void {
  const done = new Set(appliedMigrations(db));
  const record = db.prepare("INSERT INTO _migrations (id) VALUES (?)");
  for (const m of migrations) {
    if (done.has(m.id)) continue;
    db.exec("BEGIN");
    try {
      m.up(db);
      record.run(m.id);
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw new Error(`Migration "${m.id}" failed`, { cause: err });
    }
  }
}

// ---------- connection ----------

const DB_PATH = process.env.SPOTTER_DB_PATH ?? path.join(process.cwd(), "data", "spotter.db");

declare global {
  var __spotterDb: DatabaseSync | undefined;
}

/** Open a connection with Spotter's pragmas and run pending migrations. */
export function openDb(file: string = DB_PATH): DatabaseSync {
  if (file !== ":memory:") mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  migrate(db);
  return db;
}

/** Shared connection; cached on globalThis so dev HMR doesn't open a new handle on each reload. */
export function getDb(): DatabaseSync {
  globalThis.__spotterDb ??= openDb();
  return globalThis.__spotterDb;
}

/** Replace the shared connection (tests use this to start from a clean in-memory database). */
export function resetDbForTests(): DatabaseSync {
  globalThis.__spotterDb?.close();
  globalThis.__spotterDb = openDb(":memory:");
  return globalThis.__spotterDb;
}

/** Run `fn` inside a transaction, rolling back on error. */
export function tx<T>(fn: (db: DatabaseSync) => T): T {
  const db = getDb();
  db.exec("BEGIN");
  try {
    const result = fn(db);
    db.exec("COMMIT");
    return result;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

// ---------- typed query helpers ----------

const statements = new WeakMap<DatabaseSync, Map<string, StatementSync>>();

function statement(sql: string): StatementSync {
  const db = getDb();
  let cache = statements.get(db);
  if (!cache) {
    cache = new Map();
    statements.set(db, cache);
  }
  let stmt = cache.get(sql);
  if (!stmt) {
    stmt = db.prepare(sql);
    cache.set(sql, stmt);
  }
  return stmt;
}

/** All rows of a query, typed as `T` (which must describe the selected columns). */
export function all<T>(sql: string, ...params: SQLInputValue[]): T[] {
  return statement(sql).all(...params) as T[];
}

/** First row of a query, or `undefined`. */
export function get<T>(sql: string, ...params: SQLInputValue[]): T | undefined {
  return statement(sql).get(...params) as T | undefined;
}

/** Execute a write. */
export function run(sql: string, ...params: SQLInputValue[]) {
  return statement(sql).run(...params);
}

// ---------- row types ----------

export type RoutineRow = {
  id: number;
  title: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};
export type RoutineExerciseRow = {
  routine_id: number;
  position: number;
  exercise_id: string;
  sets: number;
  reps: number | null;
  note: string | null;
};
export type WorkoutRow = {
  id: number;
  title: string;
  routine_id: number | null;
  started_at: string;
  finished_at: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};
export type WorkoutExerciseRow = {
  id: number;
  workout_id: number;
  position: number;
  exercise_id: string;
  note: string | null;
};
export type SetRow = {
  id: number;
  workout_exercise_id: number;
  position: number;
  kind: string;
  weight_kg: number | null;
  reps: number | null;
  duration_s: number | null;
  distance_m: number | null;
  completed: number;
};
export type SettingRow = { key: string; value: string };
