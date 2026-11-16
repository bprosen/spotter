/** Settings, and the whole-dataset operations: sample data, import and reset. */
import type { DatabaseSync } from "node:sqlite";
import { isExerciseId } from "@/data/exercises";
import { nowMs } from "./dates";
import { get, run } from "./db.server";
import { serverFeatures } from "./features.server";
import * as V from "./mutate.server";
import { insertRoutine, parseRoutine, ROUTINE_LIMITS } from "./routines.server";
import { SAMPLE_ROUTINES, SAMPLE_SETTINGS, type SampleSet, sampleWorkouts } from "./sample-data";
import type { Snapshot } from "./types";
import { isDistanceUnit, isWeightUnit } from "./units";
import { LIMITS } from "./workouts.server";

// ---------- settings ----------

function setSetting(key: string, value: string | null) {
  if (value == null) run("DELETE FROM settings WHERE key = ?", key);
  else
    run(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      key,
      value,
    );
}

export type SettingsInput = {
  displayName?: unknown;
  weightUnit?: unknown;
  distanceUnit?: unknown;
  weeklyGoal?: unknown;
  weekStart?: unknown;
};

export function saveSettings(input: SettingsInput) {
  return V.mutate(() => {
    if (input.displayName !== undefined)
      setSetting("displayName", V.str(input.displayName, "Display name", { max: 40 }));
    if (input.weightUnit !== undefined) {
      if (!isWeightUnit(input.weightUnit)) throw new V.UserError("Weight unit must be kg or lb");
      setSetting("weightUnit", input.weightUnit);
    }
    if (input.distanceUnit !== undefined) {
      if (!isDistanceUnit(input.distanceUnit)) throw new V.UserError("Distance unit must be km or mi");
      setSetting("distanceUnit", input.distanceUnit);
    }
    if (input.weeklyGoal !== undefined) {
      const n = V.int(input.weeklyGoal, "Weekly goal", { min: 1, max: 14 });
      setSetting("weeklyGoal", n == null ? null : String(n));
    }
    if (input.weekStart !== undefined) {
      if (input.weekStart !== 0 && input.weekStart !== 1) throw new V.UserError("Weeks start on Sunday or Monday");
      setSetting("weekStart", String(input.weekStart));
    }
  });
}

// ---------- bulk ----------

const BASE_TABLES = ["workout_sets", "workout_exercises", "workouts", "routine_exercises", "routines", "settings"];

function clearAll(db: DatabaseSync) {
  for (const f of serverFeatures()) f.reset?.(db);
  for (const t of BASE_TABLES) run(`DELETE FROM ${t}`);
}

export function resetAll() {
  return V.mutate((db) => clearAll(db));
}

/** A local time `daysAgo` days before today, as an ISO timestamp. */
function daysAgoAt(daysAgo: number, hour: number, minute = 0): string {
  const now = new Date(nowMs());
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo, hour, minute).toISOString();
}

function insertSets(lineId: number, sets: SampleSet[]) {
  sets.forEach((s, i) => {
    run(
      "INSERT INTO workout_sets (workout_exercise_id, position, kind, weight_kg, reps, duration_s, distance_m, completed) VALUES (?, ?, ?, ?, ?, ?, ?, 1)",
      lineId,
      i,
      s.kind,
      s.weightKg,
      s.reps,
      s.durationS,
      s.distanceM,
    );
  });
}

/**
 * Merge the demo dataset into whatever is already there, then let each feature add its own demo rows. Running
 * it twice adds nothing new: routines are skipped if one has the same title, and workouts if one with the same
 * title started at the same time.
 */
export function loadSampleData() {
  return V.mutate((db) => {
    for (const r of SAMPLE_ROUTINES) {
      if (get("SELECT 1 FROM routines WHERE title = ?", r.title)) continue;
      insertRoutine(parseRoutine(r));
    }
    for (const w of sampleWorkouts()) {
      const startedAt = daysAgoAt(w.daysAgo, w.hour);
      if (get("SELECT 1 FROM workouts WHERE title = ? AND started_at = ?", w.title, startedAt)) continue;
      const routine = w.routine ? get<{ id: number }>("SELECT id FROM routines WHERE title = ?", w.routine) : undefined;
      const finishedAt = new Date(new Date(startedAt).getTime() + w.minutes * 60_000).toISOString();
      const { lastInsertRowid } = run(
        "INSERT INTO workouts (title, routine_id, started_at, finished_at, note) VALUES (?, ?, ?, ?, ?)",
        w.title,
        routine?.id ?? null,
        startedAt,
        finishedAt,
        w.note,
      );
      w.exercises.forEach((e, position) => {
        const line = run(
          "INSERT INTO workout_exercises (workout_id, position, exercise_id) VALUES (?, ?, ?)",
          Number(lastInsertRowid),
          position,
          e.exerciseId,
        );
        insertSets(Number(line.lastInsertRowid), e.sets);
      });
    }
    if (!get("SELECT 1 FROM settings WHERE key = 'displayName'"))
      setSetting("displayName", SAMPLE_SETTINGS.displayName);
    for (const f of serverFeatures()) f.loadSample?.(db);
  });
}

/**
 * Replace all data with an exported snapshot, keeping the original ids so feature data that points at workouts
 * and routines still lines up. Anything invalid (unknown exercises, broken numbers or dates) is dropped rather
 * than failing the whole import. Each feature then restores its own slice from `snapshot.features[id]`.
 */
export function importData(input: { snapshot: unknown }) {
  return V.mutate((db) => {
    const s = input.snapshot as Partial<Record<keyof Snapshot, unknown>> | null;
    if (!s || typeof s !== "object" || !Array.isArray(s.workouts) || !Array.isArray(s.routines))
      throw new V.UserError("That doesn't look like a Spotter export");
    clearAll(db);
    for (const r of s.routines) importRoutine(r);
    for (const w of s.workouts) importWorkout(w);
    importSettings(s.settings);
    const slices = (s.features && typeof s.features === "object" ? s.features : {}) as Record<string, unknown>;
    for (const f of serverFeatures()) {
      if (f.importData && slices[f.id] !== undefined) f.importData(db, slices[f.id]);
    }
  });
}

type Loose = Record<string, unknown>;

function positiveId(v: unknown): number | null {
  return Number.isInteger(v) && (v as number) > 0 ? (v as number) : null;
}

function text(v: unknown, max: number): string | null {
  return typeof v === "string" ? v.trim().slice(0, max) || null : null;
}

function nonNegative(v: unknown, max: number): number | null {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= max ? v : null;
}

function wholeNonNegative(v: unknown, max: number): number | null {
  return Number.isInteger(v) && (v as number) >= 0 && (v as number) <= max ? (v as number) : null;
}

function importRoutine(raw: unknown) {
  const r = (raw ?? {}) as Loose;
  const id = positiveId(r.id);
  const title = text(r.title, 120);
  if (!id || !title || get("SELECT 1 FROM routines WHERE id = ?", id)) return;
  const exercises = (Array.isArray(r.exercises) ? r.exercises : [])
    .map((x) => (x ?? {}) as Loose)
    .flatMap((x) => {
      if (!isExerciseId(x.exerciseId)) return [];
      const sets = wholeNonNegative(x.sets, ROUTINE_LIMITS.sets);
      const reps = wholeNonNegative(x.reps, 1000);
      return [{ exerciseId: x.exerciseId, sets: sets || 3, reps: reps || null, note: text(x.note, 200) }];
    })
    .slice(0, ROUTINE_LIMITS.exercises);
  insertRoutine({ title, description: text(r.description, 1000), exercises }, id);
  keepTimestamps("routines", id, r);
}

/** Restore exported created/updated times, so an import is a faithful copy. */
function keepTimestamps(table: "routines" | "workouts", id: number, raw: Loose) {
  const created = V.safeTimestamp(raw.createdAt);
  const updated = V.safeTimestamp(raw.updatedAt);
  if (created) run(`UPDATE ${table} SET created_at = ? WHERE id = ?`, created, id);
  if (updated) run(`UPDATE ${table} SET updated_at = ? WHERE id = ?`, updated, id);
}

function importWorkout(raw: unknown) {
  const w = (raw ?? {}) as Loose;
  const id = positiveId(w.id);
  const startedAt = V.safeTimestamp(w.startedAt);
  if (!id || !startedAt || get("SELECT 1 FROM workouts WHERE id = ?", id)) return;
  let finishedAt = V.safeTimestamp(w.finishedAt);
  if (finishedAt && finishedAt < startedAt) finishedAt = startedAt;
  // Only one workout can be in progress; any others come in finished at the moment they started.
  if (!finishedAt && get("SELECT 1 FROM workouts WHERE finished_at IS NULL")) finishedAt = startedAt;
  const routineId = positiveId(w.routineId);
  run(
    "INSERT INTO workouts (id, title, routine_id, started_at, finished_at, note) VALUES (?, ?, ?, ?, ?, ?)",
    id,
    text(w.title, 120) ?? "Workout",
    routineId && get("SELECT 1 FROM routines WHERE id = ?", routineId) ? routineId : null,
    startedAt,
    finishedAt,
    text(w.note, 2000),
  );
  const lines = (Array.isArray(w.exercises) ? w.exercises : [])
    .map((x) => (x ?? {}) as Loose)
    .filter((x) => isExerciseId(x.exerciseId))
    .slice(0, LIMITS.exercises);
  lines.forEach((l, position) => {
    const lineId = positiveId(l.id);
    const line = run(
      "INSERT INTO workout_exercises (id, workout_id, position, exercise_id, note) VALUES (?, ?, ?, ?, ?)",
      lineId && !get("SELECT 1 FROM workout_exercises WHERE id = ?", lineId) ? lineId : null,
      id,
      position,
      l.exerciseId as string,
      text(l.note, 500),
    );
    const sets = (Array.isArray(l.sets) ? l.sets : []).map((x) => (x ?? {}) as Loose).slice(0, LIMITS.sets);
    sets.forEach((s, i) => {
      const setId = positiveId(s.id);
      run(
        "INSERT INTO workout_sets (id, workout_exercise_id, position, kind, weight_kg, reps, duration_s, distance_m, completed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        setId && !get("SELECT 1 FROM workout_sets WHERE id = ?", setId) ? setId : null,
        Number(line.lastInsertRowid),
        i,
        s.kind === "warmup" ? "warmup" : "working",
        nonNegative(s.weightKg, 2000),
        wholeNonNegative(s.reps, 10_000),
        wholeNonNegative(s.durationS, 86_400),
        nonNegative(s.distanceM, 1_000_000),
        s.completed === true ? 1 : 0,
      );
    });
  });
  keepTimestamps("workouts", id, w);
}

function importSettings(raw: unknown) {
  const st = (raw ?? {}) as Loose;
  const name = text(st.displayName, 40);
  if (name) setSetting("displayName", name);
  if (isWeightUnit(st.weightUnit)) setSetting("weightUnit", st.weightUnit);
  if (isDistanceUnit(st.distanceUnit)) setSetting("distanceUnit", st.distanceUnit);
  if (Number.isInteger(st.weeklyGoal) && (st.weeklyGoal as number) >= 1 && (st.weeklyGoal as number) <= 14)
    setSetting("weeklyGoal", String(st.weeklyGoal));
  if (st.weekStart === 0 || st.weekStart === 1) setSetting("weekStart", String(st.weekStart));
}
