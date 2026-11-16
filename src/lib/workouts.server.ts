/**
 * Reading and changing workouts, their exercises ("lines") and sets. The plain functions here validate their
 * input, fire `onWorkoutChange` and must run inside a transaction; features call them from their own `mutate`
 * blocks. The `…Workout`/`…Set` exports at the bottom wrap them for the server functions.
 */
import type { Measure } from "@/data/exercises";
import { nowISO, partOfDay } from "./dates";
import { all, get, getDb, NOW, run, type SetRow, type WorkoutExerciseRow, type WorkoutRow } from "./db.server";
import { emitWorkout } from "./features.server";
import * as V from "./mutate.server";
import { getRoutine } from "./routines.server";
import { defaultTitle } from "./training";
import type { SetKind, Workout, WorkoutExercise, WorkoutSet } from "./types";

export const LIMITS = { exercises: 40, sets: 30 } as const;

// ---------- reading ----------

export function toSet(r: SetRow): WorkoutSet {
  return {
    id: r.id,
    kind: r.kind as SetKind,
    weightKg: r.weight_kg,
    reps: r.reps,
    durationS: r.duration_s,
    distanceM: r.distance_m,
    completed: r.completed === 1,
  };
}

export function toWorkout(r: WorkoutRow, lines: WorkoutExerciseRow[], sets: SetRow[]): Workout {
  const byLine = new Map<number, SetRow[]>();
  for (const s of sets) {
    const list = byLine.get(s.workout_exercise_id) ?? [];
    list.push(s);
    byLine.set(s.workout_exercise_id, list);
  }
  return {
    id: r.id,
    title: r.title,
    routineId: r.routine_id,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    note: r.note,
    exercises: lines
      .sort((a, b) => a.position - b.position)
      .map(
        (l): WorkoutExercise => ({
          id: l.id,
          exerciseId: l.exercise_id,
          note: l.note,
          sets: (byLine.get(l.id) ?? []).sort((a, b) => a.position - b.position).map(toSet),
        }),
      ),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function getWorkout(id: number): Workout | undefined {
  const r = get<WorkoutRow>("SELECT * FROM workouts WHERE id = ?", id);
  if (!r) return undefined;
  const lines = all<WorkoutExerciseRow>("SELECT * FROM workout_exercises WHERE workout_id = ?", id);
  const sets = all<SetRow>(
    "SELECT s.* FROM workout_sets s JOIN workout_exercises we ON we.id = s.workout_exercise_id WHERE we.workout_id = ?",
    id,
  );
  return toWorkout(r, lines, sets);
}

/** Every workout, newest first. */
export function listWorkouts(): Workout[] {
  const lines = new Map<number, WorkoutExerciseRow[]>();
  for (const l of all<WorkoutExerciseRow>("SELECT * FROM workout_exercises")) {
    const list = lines.get(l.workout_id) ?? [];
    list.push(l);
    lines.set(l.workout_id, list);
  }
  const sets = all<SetRow>("SELECT * FROM workout_sets");
  const setsByLine = new Map<number, SetRow[]>();
  for (const s of sets) {
    const list = setsByLine.get(s.workout_exercise_id) ?? [];
    list.push(s);
    setsByLine.set(s.workout_exercise_id, list);
  }
  return all<WorkoutRow>("SELECT * FROM workouts ORDER BY started_at DESC, id DESC").map((w) => {
    const ls = lines.get(w.id) ?? [];
    return toWorkout(
      w,
      ls,
      ls.flatMap((l) => setsByLine.get(l.id) ?? []),
    );
  });
}

/** The workout in progress, if any. */
export function getActiveWorkout(): Workout | undefined {
  const r = get<{ id: number }>("SELECT id FROM workouts WHERE finished_at IS NULL");
  return r && getWorkout(r.id);
}

function mustGet(id: unknown): Workout {
  const w = getWorkout(V.id(id, "Workout"));
  if (!w) throw new V.UserError("Workout not found");
  return w;
}

type LineRef = { line: WorkoutExerciseRow; workout: Workout };

function mustGetLine(lineId: unknown): LineRef {
  const line = get<WorkoutExerciseRow>("SELECT * FROM workout_exercises WHERE id = ?", V.id(lineId, "Exercise"));
  if (!line) throw new V.UserError("Exercise not found");
  return { line, workout: getWorkout(line.workout_id)! };
}

function mustGetSet(setId: unknown): { set: SetRow } & LineRef {
  const set = get<SetRow>("SELECT * FROM workout_sets WHERE id = ?", V.id(setId, "Set"));
  if (!set) throw new V.UserError("Set not found");
  return { set, ...mustGetLine(set.workout_exercise_id) };
}

/**
 * Completed sets (warm-ups included) from the latest finished workout with any for this exercise. Used to
 * pre-fill new sets with what was lifted last time.
 */
export function lastSetsFor(exerciseId: string, excludeWorkoutId = 0): WorkoutSet[] {
  const latest = get<{ id: number }>(
    `SELECT w.id FROM workouts w
       JOIN workout_exercises we ON we.workout_id = w.id
       JOIN workout_sets s ON s.workout_exercise_id = we.id
     WHERE we.exercise_id = ? AND w.finished_at IS NOT NULL AND s.completed = 1 AND w.id != ?
     ORDER BY w.started_at DESC, w.id DESC LIMIT 1`,
    exerciseId,
    excludeWorkoutId,
  );
  if (!latest) return [];
  return all<SetRow>(
    `SELECT s.* FROM workout_sets s JOIN workout_exercises we ON we.id = s.workout_exercise_id
     WHERE we.workout_id = ? AND we.exercise_id = ? AND s.completed = 1 ORDER BY we.position, s.position`,
    latest.id,
    exerciseId,
  ).map(toSet);
}

// ---------- writing helpers ----------

type SetValues = Pick<WorkoutSet, "kind" | "weightKg" | "reps" | "durationS" | "distanceM">;

const BLANK: SetValues = { kind: "working", weightKg: null, reps: null, durationS: null, distanceM: null };

function touch(workoutId: number) {
  run(`UPDATE workouts SET updated_at = ${NOW} WHERE id = ?`, workoutId);
}

function insertLine(workoutId: number, exerciseId: string, sets: SetValues[], note: string | null = null): number {
  const count = get<{ n: number }>("SELECT COUNT(*) AS n FROM workout_exercises WHERE workout_id = ?", workoutId)!.n;
  if (count >= LIMITS.exercises) throw new V.UserError(`A workout can have at most ${LIMITS.exercises} exercises`);
  const { lastInsertRowid } = run(
    "INSERT INTO workout_exercises (workout_id, position, exercise_id, note) VALUES (?, ?, ?, ?)",
    workoutId,
    count,
    exerciseId,
    note,
  );
  const lineId = Number(lastInsertRowid);
  sets.forEach((s, i) => {
    insertSet(lineId, i, s, false);
  });
  return lineId;
}

function insertSet(lineId: number, position: number, s: SetValues, completed: boolean): number {
  const { lastInsertRowid } = run(
    "INSERT INTO workout_sets (workout_exercise_id, position, kind, weight_kg, reps, duration_s, distance_m, completed) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    lineId,
    position,
    s.kind,
    s.weightKg,
    s.reps,
    s.durationS,
    s.distanceM,
    completed ? 1 : 0,
  );
  return Number(lastInsertRowid);
}

/** Write positions 0, 1, 2… in the given order. */
function setPositions(table: "workout_exercises" | "workout_sets", ids: number[]) {
  for (const [i, id] of ids.entries()) run(`UPDATE ${table} SET position = ? WHERE id = ?`, i, id);
}

/** Close the gaps in positions after a delete. */
function renumberLines(workoutId: number) {
  const rows = all<{ id: number }>(
    "SELECT id FROM workout_exercises WHERE workout_id = ? ORDER BY position, id",
    workoutId,
  );
  setPositions(
    "workout_exercises",
    rows.map((r) => r.id),
  );
}

function renumberSets(lineId: number) {
  const rows = all<{ id: number }>(
    "SELECT id FROM workout_sets WHERE workout_exercise_id = ? ORDER BY position, id",
    lineId,
  );
  setPositions(
    "workout_sets",
    rows.map((r) => r.id),
  );
}

/** Copy last time's numbers into fresh, unticked sets. */
function prefill(previous: WorkoutSet[]): SetValues[] {
  if (!previous.length) return [{ ...BLANK }];
  return previous.map((p) => ({
    kind: p.kind,
    weightKg: p.weightKg,
    reps: p.reps,
    durationS: p.durationS,
    distanceM: p.distanceM,
  }));
}

/** Lay out a routine's exercises as unticked sets, using its rep targets and last time's weights. */
function layOutRoutine(workoutId: number, routineId: number) {
  const routine = getRoutine(routineId);
  if (!routine) throw new V.UserError("Routine not found");
  for (const re of routine.exercises) {
    const previous = lastSetsFor(re.exerciseId, workoutId).filter((s) => s.kind === "working");
    const sets: SetValues[] = Array.from({ length: re.sets }, (_, i) => {
      const p = previous[i] ?? previous.at(-1);
      return {
        kind: "working",
        weightKg: p?.weightKg ?? null,
        reps: re.reps ?? p?.reps ?? null,
        durationS: p?.durationS ?? null,
        distanceM: p?.distanceM ?? null,
      };
    });
    insertLine(workoutId, re.exerciseId, sets, re.note);
  }
}

// ---------- workouts ----------

export type StartInput = { routineId?: unknown; title?: unknown };

/** Start a workout now, empty or laid out from a routine. Only one can be in progress. */
export function startWorkout(input: StartInput = {}): Workout {
  if (getActiveWorkout()) throw new V.UserError("Finish or discard the workout in progress first");
  const routineId = input.routineId == null ? null : V.id(input.routineId, "Routine");
  const routine = routineId == null ? undefined : getRoutine(routineId);
  if (routineId != null && !routine) throw new V.UserError("Routine not found");
  const startedAt = nowISO();
  const title = V.str(input.title, "Title", { max: 120 }) ?? routine?.title ?? defaultTitle(partOfDay(startedAt));
  const { lastInsertRowid } = run(
    "INSERT INTO workouts (title, routine_id, started_at) VALUES (?, ?, ?)",
    title,
    routineId,
    startedAt,
  );
  const id = Number(lastInsertRowid);
  if (routineId != null) layOutRoutine(id, routineId);
  const workout = getWorkout(id)!;
  emitWorkout(getDb(), { type: "started", workout });
  return workout;
}

export type PastInput = { startedAt: unknown; finishedAt: unknown; title?: unknown; routineId?: unknown };

/**
 * Log a workout after the fact: it's created finished, and sets are ticked off as they're entered. Fires
 * "started" like a live workout, but never "finished".
 */
export function logPastWorkout(input: PastInput): Workout {
  const startedAt = V.timestamp(input.startedAt, "Start") ?? missing("Start");
  const finishedAt = V.timestamp(input.finishedAt, "End") ?? missing("End");
  if (finishedAt < startedAt) throw new V.UserError("A workout can't end before it starts");
  if (startedAt > nowISO()) throw new V.UserError("That workout hasn't happened yet");
  const routineId = input.routineId == null ? null : V.id(input.routineId, "Routine");
  const routine = routineId == null ? undefined : getRoutine(routineId);
  if (routineId != null && !routine) throw new V.UserError("Routine not found");
  const title = V.str(input.title, "Title", { max: 120 }) ?? routine?.title ?? defaultTitle(partOfDay(startedAt));
  const { lastInsertRowid } = run(
    "INSERT INTO workouts (title, routine_id, started_at, finished_at) VALUES (?, ?, ?, ?)",
    title,
    routineId,
    startedAt,
    finishedAt,
  );
  const id = Number(lastInsertRowid);
  if (routineId != null) layOutRoutine(id, routineId);
  const workout = getWorkout(id)!;
  emitWorkout(getDb(), { type: "started", workout });
  return workout;
}

/** The later of two ISO timestamps (they compare as strings). */
function later(a: string, b: string): string {
  if (a >= b) return a;
  return b;
}

function missing(field: string): never {
  throw new V.UserError(`${field} is required`);
}

export type WorkoutPatch = {
  id: unknown;
  title?: unknown;
  note?: unknown;
  startedAt?: unknown;
  /** Only for finished workouts. Finish an in-progress one with `finishWorkout`. */
  finishedAt?: unknown;
};

/** Change a workout's details. Fields left out keep their value. */
export function editWorkout(patch: WorkoutPatch): Workout {
  const before = mustGet(patch.id);
  const title =
    patch.title === undefined ? before.title : (V.str(patch.title, "Title", { required: true, max: 120 }) as string);
  const note = patch.note === undefined ? before.note : V.str(patch.note, "Note", { max: 2000 });
  const startedAt =
    patch.startedAt === undefined ? before.startedAt : (V.timestamp(patch.startedAt, "Start") ?? missing("Start"));
  let finishedAt = before.finishedAt;
  if (patch.finishedAt !== undefined) {
    if (before.finishedAt == null) throw new V.UserError("Finish the workout to set when it ended");
    finishedAt = V.timestamp(patch.finishedAt, "End") ?? missing("End");
  }
  if (finishedAt && finishedAt < startedAt) throw new V.UserError("A workout can't end before it starts");
  if (startedAt > nowISO()) throw new V.UserError("A workout can't start in the future");
  run(
    `UPDATE workouts SET title = ?, note = ?, started_at = ?, finished_at = ?, updated_at = ${NOW} WHERE id = ?`,
    title,
    note,
    startedAt,
    finishedAt,
    before.id,
  );
  const workout = getWorkout(before.id)!;
  emitWorkout(getDb(), { type: "updated", workout });
  return workout;
}

/**
 * Finish the workout in progress: drop sets that were never ticked off and exercises left empty, then stamp
 * the end time. Refuses if nothing was done; discard it instead.
 */
export function finishWorkout(input: { id: unknown; title?: unknown; note?: unknown }): Workout {
  const before = mustGet(input.id);
  if (before.finishedAt) throw new V.UserError("That workout is already finished");
  const done = before.exercises.some((l) => l.sets.some((s) => s.completed));
  if (!done) throw new V.UserError("Tick off at least one set before finishing, or discard the workout");
  run(
    "DELETE FROM workout_sets WHERE completed = 0 AND workout_exercise_id IN (SELECT id FROM workout_exercises WHERE workout_id = ?)",
    before.id,
  );
  run(
    "DELETE FROM workout_exercises WHERE workout_id = ? AND id NOT IN (SELECT workout_exercise_id FROM workout_sets)",
    before.id,
  );
  renumberLines(before.id);
  for (const l of all<{ id: number }>("SELECT id FROM workout_exercises WHERE workout_id = ?", before.id))
    renumberSets(l.id);
  const now = nowISO();
  const title = input.title === undefined ? before.title : V.str(input.title, "Title", { required: true, max: 120 });
  const note = input.note === undefined ? before.note : V.str(input.note, "Note", { max: 2000 });
  run(
    `UPDATE workouts SET finished_at = ?, title = ?, note = ?, updated_at = ${NOW} WHERE id = ?`,
    later(now, before.startedAt),
    title,
    note,
    before.id,
  );
  const workout = getWorkout(before.id)!;
  emitWorkout(getDb(), { type: "finished", workout });
  return workout;
}

/** Delete a workout, finished or not (discarding one in progress is the same thing). */
export function removeWorkout(input: { id: unknown }): void {
  const workout = mustGet(input.id);
  run("DELETE FROM workouts WHERE id = ?", workout.id);
  emitWorkout(getDb(), { type: "deleted", workout });
}

// ---------- exercises within a workout ----------

/** Add an exercise to the end of a workout, with last time's sets pre-filled (unticked). */
export function addExercise(input: { workoutId: unknown; exerciseId: unknown }): WorkoutExercise {
  const workout = mustGet(input.workoutId);
  const e = V.exercise(input.exerciseId);
  const lineId = insertLine(workout.id, e.id, prefill(lastSetsFor(e.id, workout.id)));
  touch(workout.id);
  const after = getWorkout(workout.id)!;
  emitWorkout(getDb(), { type: "updated", workout: after });
  return after.exercises.find((l) => l.id === lineId)!;
}

export function removeExercise(input: { lineId: unknown }): void {
  const { line, workout } = mustGetLine(input.lineId);
  run("DELETE FROM workout_exercises WHERE id = ?", line.id);
  renumberLines(workout.id);
  touch(workout.id);
  emitWorkout(getDb(), { type: "updated", workout: getWorkout(workout.id)! });
}

/** Move an exercise up (-1) or down (+1). Moving past either end does nothing. */
export function moveExercise(input: { lineId: unknown; by: unknown }): void {
  const { line, workout } = mustGetLine(input.lineId);
  const by = V.int(input.by, "Move", { min: -1, max: 1 });
  const ids = workout.exercises.map((l) => l.id);
  const from = ids.indexOf(line.id);
  const to = from + (by ?? 0);
  if (to < 0 || to >= ids.length || to === from) return;
  ids.splice(from, 1);
  ids.splice(to, 0, line.id);
  setPositions("workout_exercises", ids);
  touch(workout.id);
  emitWorkout(getDb(), { type: "updated", workout: getWorkout(workout.id)! });
}

export function editExerciseNote(input: { lineId: unknown; note: unknown }): void {
  const { line, workout } = mustGetLine(input.lineId);
  run("UPDATE workout_exercises SET note = ? WHERE id = ?", V.str(input.note, "Note", { max: 500 }), line.id);
  touch(workout.id);
  emitWorkout(getDb(), { type: "updated", workout: getWorkout(workout.id)! });
}

// ---------- sets ----------

/** Add a set to an exercise, copying the numbers from its last set. */
export function addSet(input: { lineId: unknown }): WorkoutSet {
  const { line, workout } = mustGetLine(input.lineId);
  const sets = workout.exercises.find((l) => l.id === line.id)!.sets;
  if (sets.length >= LIMITS.sets) throw new V.UserError(`An exercise can have at most ${LIMITS.sets} sets`);
  const last = sets.at(-1);
  const id = insertSet(
    line.id,
    sets.length,
    last ? { ...last, kind: last.kind === "warmup" ? "working" : last.kind } : BLANK,
    false,
  );
  touch(workout.id);
  emitWorkout(getDb(), { type: "updated", workout: getWorkout(workout.id)! });
  return toSet(get<SetRow>("SELECT * FROM workout_sets WHERE id = ?", id)!);
}

export type SetPatch = {
  id: unknown;
  kind?: unknown;
  weightKg?: unknown;
  reps?: unknown;
  durationS?: unknown;
  distanceM?: unknown;
  completed?: unknown;
};

/** What a set needs before it can be ticked off, by measure. */
function checkComplete(s: SetValues, measure: Measure) {
  switch (measure) {
    case "weight":
      if (s.weightKg == null) throw new V.UserError("Enter a weight before ticking off the set");
      if (!s.reps) throw new V.UserError("Enter the reps before ticking off the set");
      return;
    case "reps":
      if (!s.reps) throw new V.UserError("Enter the reps before ticking off the set");
      return;
    case "time":
      if (!s.durationS) throw new V.UserError("Enter a time before ticking off the set");
      return;
    case "distance":
      if (!s.distanceM && !s.durationS) throw new V.UserError("Enter a distance or time before ticking off the set");
      return;
  }
}

/**
 * Change a set. Fields left out keep their value; null clears one. Ticking it off checks the set has the
 * numbers its exercise needs and fires "set-completed".
 */
export function editSet(patch: SetPatch): { workout: Workout; line: WorkoutExercise; set: WorkoutSet } {
  const { set: row, line, workout } = mustGetSet(patch.id);
  const before = toSet(row);
  const e = V.exercise(line.exercise_id);
  const kind = patch.kind === undefined ? before.kind : patch.kind;
  if (kind !== "warmup" && kind !== "working") throw new V.UserError("Set type must be warm-up or working");
  const next: SetValues & { completed: boolean } = {
    kind,
    weightKg: patch.weightKg === undefined ? before.weightKg : V.amount(patch.weightKg, "Weight", { max: 2000 }),
    reps: patch.reps === undefined ? before.reps : V.int(patch.reps, "Reps", { min: 0, max: 10_000 }),
    durationS:
      patch.durationS === undefined ? before.durationS : V.int(patch.durationS, "Time", { min: 0, max: 86_400 }),
    distanceM:
      patch.distanceM === undefined ? before.distanceM : V.amount(patch.distanceM, "Distance", { max: 1_000_000 }),
    completed: patch.completed === undefined ? before.completed : V.bool(patch.completed, "Completed"),
  };
  if (next.completed) checkComplete(next, e.measure);
  run(
    "UPDATE workout_sets SET kind = ?, weight_kg = ?, reps = ?, duration_s = ?, distance_m = ?, completed = ? WHERE id = ?",
    next.kind,
    next.weightKg,
    next.reps,
    next.durationS,
    next.distanceM,
    next.completed ? 1 : 0,
    row.id,
  );
  touch(workout.id);
  const after = getWorkout(workout.id)!;
  const afterLine = after.exercises.find((l) => l.id === line.id)!;
  const set = afterLine.sets.find((s) => s.id === row.id)!;
  if (set.completed && !before.completed)
    emitWorkout(getDb(), { type: "set-completed", workout: after, line: afterLine, set });
  else emitWorkout(getDb(), { type: "updated", workout: after });
  return { workout: after, line: afterLine, set };
}

export function removeSet(input: { id: unknown }): void {
  const { set, line, workout } = mustGetSet(input.id);
  run("DELETE FROM workout_sets WHERE id = ?", set.id);
  renumberSets(line.id);
  touch(workout.id);
  emitWorkout(getDb(), { type: "updated", workout: getWorkout(workout.id)! });
}

// ---------- server function handlers ----------

export const startWorkoutFn = (input: StartInput) => V.mutate(() => startWorkout(input));
export const logPastWorkoutFn = (input: PastInput) => V.mutate(() => logPastWorkout(input));
export const updateWorkoutFn = (input: WorkoutPatch) => V.mutate(() => editWorkout(input));
export const finishWorkoutFn = (input: { id: unknown; title?: unknown; note?: unknown }) =>
  V.mutate(() => finishWorkout(input));
export const deleteWorkoutFn = (input: { id: unknown }) => V.mutate(() => removeWorkout(input));
export const addExerciseFn = (input: { workoutId: unknown; exerciseId: unknown }) => V.mutate(() => addExercise(input));
export const removeExerciseFn = (input: { lineId: unknown }) => V.mutate(() => removeExercise(input));
export const moveExerciseFn = (input: { lineId: unknown; by: unknown }) => V.mutate(() => moveExercise(input));
export const editExerciseNoteFn = (input: { lineId: unknown; note: unknown }) =>
  V.mutate(() => editExerciseNote(input));
export const addSetFn = (input: { lineId: unknown }) => V.mutate(() => addSet(input));
export const updateSetFn = (input: SetPatch) => V.mutate(() => editSet(input));
export const removeSetFn = (input: { id: unknown }) => V.mutate(() => removeSet(input));
