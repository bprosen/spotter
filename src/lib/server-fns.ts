/**
 * TanStack Start server functions (RPC) for the base app. Loaders and components import from here; the SQLite
 * code in `*.server.ts` never reaches the browser bundle. Features define their own in their folder, the same way.
 */
import { createServerFn } from "@tanstack/react-start";
import * as D from "./data.server";
import * as R from "./routines.server";
import { readSnapshot } from "./snapshot.server";
import type { SetKind } from "./types";
import type { DistanceUnit, WeightUnit } from "./units";
import * as W from "./workouts.server";

/** Minimal runtime guard: payloads must be plain objects. Field-level validation happens in the handlers. */
export function objectInput<T>(d: T): T {
  if (typeof d !== "object" || d === null || Array.isArray(d)) throw new Error("Invalid input");
  return d;
}

export const getSnapshot = createServerFn({ method: "GET" }).handler(() => readSnapshot());

type IdInput = { id: number };

// ---------- workouts ----------

export const startWorkout = createServerFn({ method: "POST" })
  .validator((d: { routineId?: number | null; title?: string }) => objectInput(d))
  .handler(({ data }) => W.startWorkoutFn(data));

export const logPastWorkout = createServerFn({ method: "POST" })
  .validator((d: { startedAt: string; finishedAt: string; title?: string; routineId?: number | null }) =>
    objectInput(d),
  )
  .handler(({ data }) => W.logPastWorkoutFn(data));

export const updateWorkout = createServerFn({ method: "POST" })
  .validator((d: IdInput & { title?: string; note?: string | null; startedAt?: string; finishedAt?: string }) =>
    objectInput(d),
  )
  .handler(({ data }) => W.updateWorkoutFn(data));

export const finishWorkout = createServerFn({ method: "POST" })
  .validator((d: IdInput & { title?: string; note?: string | null }) => objectInput(d))
  .handler(({ data }) => W.finishWorkoutFn(data));

export const deleteWorkout = createServerFn({ method: "POST" })
  .validator((d: IdInput) => objectInput(d))
  .handler(({ data }) => W.deleteWorkoutFn(data));

// ---------- exercises within a workout ----------

export const addWorkoutExercise = createServerFn({ method: "POST" })
  .validator((d: { workoutId: number; exerciseId: string }) => objectInput(d))
  .handler(({ data }) => W.addExerciseFn(data));

export const removeWorkoutExercise = createServerFn({ method: "POST" })
  .validator((d: { lineId: number }) => objectInput(d))
  .handler(({ data }) => W.removeExerciseFn(data));

export const moveWorkoutExercise = createServerFn({ method: "POST" })
  .validator((d: { lineId: number; by: -1 | 1 }) => objectInput(d))
  .handler(({ data }) => W.moveExerciseFn(data));

export const editWorkoutExerciseNote = createServerFn({ method: "POST" })
  .validator((d: { lineId: number; note: string | null }) => objectInput(d))
  .handler(({ data }) => W.editExerciseNoteFn(data));

// ---------- sets ----------

export type SetFields = {
  kind?: SetKind;
  weightKg?: number | null;
  reps?: number | null;
  durationS?: number | null;
  distanceM?: number | null;
  completed?: boolean;
};

export const addSet = createServerFn({ method: "POST" })
  .validator((d: { lineId: number }) => objectInput(d))
  .handler(({ data }) => W.addSetFn(data));

export const updateSet = createServerFn({ method: "POST" })
  .validator((d: SetFields & IdInput) => objectInput(d))
  .handler(({ data }) => W.updateSetFn(data));

export const removeSet = createServerFn({ method: "POST" })
  .validator((d: IdInput) => objectInput(d))
  .handler(({ data }) => W.removeSetFn(data));

// ---------- routines ----------

export type RoutineFields = {
  title: string;
  description?: string | null;
  exercises: { exerciseId: string; sets: number; reps?: number | null; note?: string | null }[];
};

export const createRoutine = createServerFn({ method: "POST" })
  .validator((d: RoutineFields) => objectInput(d))
  .handler(({ data }) => R.createRoutineFn(data));

export const updateRoutine = createServerFn({ method: "POST" })
  .validator((d: RoutineFields & IdInput) => objectInput(d))
  .handler(({ data }) => R.updateRoutineFn(data));

export const deleteRoutine = createServerFn({ method: "POST" })
  .validator((d: IdInput) => objectInput(d))
  .handler(({ data }) => R.deleteRoutineFn(data));

export const routineFromWorkout = createServerFn({ method: "POST" })
  .validator((d: { workoutId: number; title?: string }) => objectInput(d))
  .handler(({ data }) => R.routineFromWorkoutFn(data));

// ---------- settings and data ----------

export const saveSettings = createServerFn({ method: "POST" })
  .validator(
    (d: {
      displayName?: string;
      weightUnit?: WeightUnit;
      distanceUnit?: DistanceUnit;
      weeklyGoal?: number;
      weekStart?: 0 | 1;
    }) => objectInput(d),
  )
  .handler(({ data }) => D.saveSettings(data));

export const loadSampleData = createServerFn({ method: "POST" }).handler(() => D.loadSampleData());

export const resetAll = createServerFn({ method: "POST" }).handler(() => D.resetAll());

export const importData = createServerFn({ method: "POST" })
  .validator((d: { snapshot: unknown }) => objectInput(d))
  .handler(({ data }) => D.importData(data));
