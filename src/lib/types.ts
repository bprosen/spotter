/** Shapes shared by the server (which builds them from SQLite) and the client (which renders them). */
import type { DistanceUnit, WeightUnit } from "./units";

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

/** Warm-up sets are logged but left out of volume, records and progression. */
export type SetKind = "warmup" | "working";
export const SET_KINDS: SetKind[] = ["warmup", "working"];

export type WorkoutSet = {
  id: number;
  kind: SetKind;
  /** Load in kilograms. For `reps` exercises this is added load (a weight belt), and may be null. */
  weightKg: number | null;
  reps: number | null;
  durationS: number | null;
  distanceM: number | null;
  /** Only completed sets count towards stats. A set is ticked off once it's actually been done. */
  completed: boolean;
};

export type WorkoutExercise = {
  id: number;
  /** A catalog exercise id (see `src/data/exercises.ts`). */
  exerciseId: string;
  note: string | null;
  /** In order. */
  sets: WorkoutSet[];
};

export type Workout = {
  id: number;
  title: string;
  /** The routine it was started from, if any (and if that routine still exists). */
  routineId: number | null;
  startedAt: string;
  /** Null while the workout is in progress. At most one workout is in progress at a time. */
  finishedAt: string | null;
  note: string | null;
  /** In order. */
  exercises: WorkoutExercise[];
  createdAt: string;
  updatedAt: string;
};

export type RoutineExercise = {
  exerciseId: string;
  /** How many sets to lay out when the routine is started. */
  sets: number;
  /** Target reps per set, if there is one. */
  reps: number | null;
  /** "pause at the bottom", "drop set on the last"… */
  note: string | null;
};

export type Routine = {
  id: number;
  title: string;
  description: string | null;
  /** In order. */
  exercises: RoutineExercise[];
  createdAt: string;
  updatedAt: string;
};

export type Settings = {
  displayName: string;
  weightUnit: WeightUnit;
  distanceUnit: DistanceUnit;
  /** Workouts per week the user is aiming for. */
  weeklyGoal: number;
  /** 1 for Monday, 0 for Sunday. */
  weekStart: 0 | 1;
};

/** Any JSON value. Feature snapshot slices must be JSON so they survive the trip to the browser and exports. */
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

/** Everything the app knows about the user. Small enough to ship whole to every page. */
export type Snapshot = {
  settings: Settings;
  /** Newest first. The in-progress workout, if any, is among them. */
  workouts: Workout[];
  /** By title. */
  routines: Routine[];
  /**
   * Each feature's own slice, keyed by feature id (see `snapshot` in `ServerFeature`).
   * Read it with `useFeatureData(id)`.
   */
  features: Record<string, Json>;
};

export const DEFAULT_SETTINGS: Settings = {
  displayName: "Athlete",
  weightUnit: "kg",
  distanceUnit: "km",
  weeklyGoal: 3,
  weekStart: 1,
};

export const EMPTY_SNAPSHOT: Snapshot = { settings: DEFAULT_SETTINGS, workouts: [], routines: [], features: {} };
