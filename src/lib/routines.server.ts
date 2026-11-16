/**
 * Reading and changing routines (reusable workout templates). As with workouts, the plain functions validate,
 * fire `onRoutineChange` and must run inside a transaction; the `…Routine` exports wrap them for the server
 * functions.
 */
import { all, get, getDb, NOW, type RoutineExerciseRow, type RoutineRow, run } from "./db.server";
import { emitRoutine } from "./features.server";
import * as V from "./mutate.server";
import type { Routine, RoutineExercise } from "./types";

export const ROUTINE_LIMITS = { exercises: 30, sets: 20 } as const;

export function toRoutine(r: RoutineRow, lines: RoutineExerciseRow[]): Routine {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    exercises: lines
      .sort((a, b) => a.position - b.position)
      .map((l) => ({ exerciseId: l.exercise_id, sets: l.sets, reps: l.reps, note: l.note })),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function getRoutine(id: number): Routine | undefined {
  const r = get<RoutineRow>("SELECT * FROM routines WHERE id = ?", id);
  return r && toRoutine(r, all<RoutineExerciseRow>("SELECT * FROM routine_exercises WHERE routine_id = ?", id));
}

/** Every routine, by title. */
export function listRoutines(): Routine[] {
  const byRoutine = new Map<number, RoutineExerciseRow[]>();
  for (const l of all<RoutineExerciseRow>("SELECT * FROM routine_exercises")) {
    const list = byRoutine.get(l.routine_id) ?? [];
    list.push(l);
    byRoutine.set(l.routine_id, list);
  }
  return all<RoutineRow>("SELECT * FROM routines ORDER BY title COLLATE NOCASE, id").map((r) =>
    toRoutine(r, byRoutine.get(r.id) ?? []),
  );
}

export type RoutineInput = {
  title: unknown;
  description?: unknown;
  exercises: unknown;
};

type ParsedRoutine = Omit<Routine, "id" | "createdAt" | "updatedAt">;

export function parseRoutineExercise(v: unknown, n: number): RoutineExercise {
  const line = (v ?? {}) as Record<string, unknown>;
  const e = V.exercise(line.exerciseId);
  return {
    exerciseId: e.id,
    sets: V.int(line.sets, `Exercise ${n} sets`, { min: 1, max: ROUTINE_LIMITS.sets }) ?? missing(`Exercise ${n} sets`),
    reps: V.int(line.reps, `Exercise ${n} reps`, { min: 1, max: 1000 }),
    note: V.str(line.note, `Exercise ${n} note`, { max: 200 }),
  };
}

export function parseRoutine(input: RoutineInput): ParsedRoutine {
  if (input.exercises != null && !Array.isArray(input.exercises)) throw new V.UserError("Exercises must be a list");
  const exercises = ((input.exercises as unknown[]) ?? []).map((v, i) => parseRoutineExercise(v, i + 1));
  if (exercises.length === 0) throw new V.UserError("Add at least one exercise");
  if (exercises.length > ROUTINE_LIMITS.exercises)
    throw new V.UserError(`A routine can have at most ${ROUTINE_LIMITS.exercises} exercises`);
  return {
    title: V.str(input.title, "Title", { required: true, max: 120 })!,
    description: V.str(input.description, "Description", { max: 1000 }),
    exercises,
  };
}

function missing(field: string): never {
  throw new V.UserError(`${field} is required`);
}

function writeExercises(routineId: number, exercises: RoutineExercise[]) {
  run("DELETE FROM routine_exercises WHERE routine_id = ?", routineId);
  exercises.forEach((e, position) => {
    run(
      "INSERT INTO routine_exercises (routine_id, position, exercise_id, sets, reps, note) VALUES (?, ?, ?, ?, ?, ?)",
      routineId,
      position,
      e.exerciseId,
      e.sets,
      e.reps,
      e.note,
    );
  });
}

/** Insert a routine that has already been parsed. `id` is only given when restoring an export. */
export function insertRoutine(r: ParsedRoutine, id?: number): number {
  const { lastInsertRowid } = run(
    "INSERT INTO routines (id, title, description) VALUES (?, ?, ?)",
    id ?? null,
    r.title,
    r.description,
  );
  const newId = Number(lastInsertRowid);
  writeExercises(newId, r.exercises);
  return newId;
}

export function addRoutine(input: RoutineInput): Routine {
  const routine = getRoutine(insertRoutine(parseRoutine(input)))!;
  emitRoutine(getDb(), { type: "created", routine });
  return routine;
}

function mustGet(id: unknown): Routine {
  const r = getRoutine(V.id(id, "Routine"));
  if (!r) throw new V.UserError("Routine not found");
  return r;
}

/** Replace a routine's contents (the whole routine is sent, as the editor does). */
export function editRoutine(input: RoutineInput & { id: unknown }): Routine {
  const before = mustGet(input.id);
  const r = parseRoutine(input);
  run(
    `UPDATE routines SET title = ?, description = ?, updated_at = ${NOW} WHERE id = ?`,
    r.title,
    r.description,
    before.id,
  );
  writeExercises(before.id, r.exercises);
  const after = getRoutine(before.id)!;
  emitRoutine(getDb(), { type: "updated", before, after });
  return after;
}

/** Delete a routine. Workouts started from it keep their sets; they just stop pointing at it. */
export function removeRoutine(input: { id: unknown }): void {
  const routine = mustGet(input.id);
  run("DELETE FROM routines WHERE id = ?", routine.id);
  emitRoutine(getDb(), { type: "deleted", routine });
}

/**
 * Save a finished workout's exercises as a new routine: one line per exercise, with its working-set count and
 * the most common rep count.
 */
export function routineFromWorkout(input: { workoutId: unknown; title?: unknown }): Routine {
  const workoutId = V.id(input.workoutId, "Workout");
  const w = get<{ title: string }>("SELECT title FROM workouts WHERE id = ?", workoutId);
  if (!w) throw new V.UserError("Workout not found");
  const lines = all<{ id: number; exercise_id: string; note: string | null }>(
    "SELECT id, exercise_id, note FROM workout_exercises WHERE workout_id = ? ORDER BY position",
    workoutId,
  );
  const exercises = lines.flatMap((l) => {
    const sets = all<{ reps: number | null }>(
      "SELECT reps FROM workout_sets WHERE workout_exercise_id = ? AND kind = 'working' ORDER BY position",
      l.id,
    );
    if (!sets.length) return [];
    return [
      {
        exerciseId: l.exercise_id,
        sets: Math.min(sets.length, ROUTINE_LIMITS.sets),
        reps: mostCommon(sets.map((s) => s.reps).filter((r): r is number => r != null && r > 0)),
        note: l.note,
      },
    ];
  });
  return addRoutine({
    title: input.title ?? w.title,
    exercises: exercises.slice(0, ROUTINE_LIMITS.exercises),
  });
}

function mostCommon(values: number[]): number | null {
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: number | null = null;
  let bestCount = 0;
  for (const [v, c] of counts)
    if (c > bestCount) {
      best = v;
      bestCount = c;
    }
  return best;
}

// ---------- server function handlers ----------

export const createRoutineFn = (input: RoutineInput) => V.mutate(() => addRoutine(input));
export const updateRoutineFn = (input: RoutineInput & { id: unknown }) => V.mutate(() => editRoutine(input));
export const deleteRoutineFn = (input: { id: unknown }) => V.mutate(() => removeRoutine(input));
export const routineFromWorkoutFn = (input: { workoutId: unknown; title?: unknown }) =>
  V.mutate(() => routineFromWorkout(input));
