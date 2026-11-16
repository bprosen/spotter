/**
 * Server half of the feature registry.
 *
 * A feature lives in `src/features/<id>/`. If it needs the database it adds `index.server.ts`, which
 * default-exports a `ServerFeature`. It is picked up automatically, with nothing to register by hand. The UI
 * half (`index.ts(x)`, see `features.ts`) must never import this file or `index.server.ts`, so SQLite stays out
 * of the browser bundle.
 *
 * Every hook gets the open connection and runs inside the caller's transaction, so a failing hook rolls the
 * whole mutation back.
 */
import type { DatabaseSync } from "node:sqlite";
import { collectFeatures } from "./collect-features";
import type { Routine, Workout, WorkoutExercise, WorkoutSet } from "./types";

export type FeatureMigration = {
  /** Unique within the feature, e.g. "001-create-body-weight". Recorded as "<feature id>/<name>" once applied. */
  name: string;
  up: (db: DatabaseSync) => void;
};

/**
 * Something happened to a workout. Fired for user actions (and for features that call the helpers in
 * `workouts.server.ts`), not for imports or sample data: features restore those through `importData` and
 * `loadSample`. `workout` is always the state after the change, except for "deleted".
 */
export type WorkoutEvent =
  | { type: "started"; workout: Workout }
  /** A set was ticked off. Fired for in-progress and finished workouts alike. */
  | { type: "set-completed"; workout: Workout; line: WorkoutExercise; set: WorkoutSet }
  /**
   * The workout was finished: unticked sets and empty exercises have been dropped. Fired once per workout, the
   * natural moment to look for personal records.
   */
  | { type: "finished"; workout: Workout }
  /** Anything else changed: details, exercises or sets. */
  | { type: "updated"; workout: Workout }
  /** Deleted, or an in-progress workout discarded. The rows are already gone. Drop anything that points at it. */
  | { type: "deleted"; workout: Workout };

export type RoutineEvent =
  | { type: "created"; routine: Routine }
  | { type: "updated"; before: Routine; after: Routine }
  /** The row is already gone. Features should drop anything that points at `routine.id`. */
  | { type: "deleted"; routine: Routine };

export type ServerFeature = {
  /** Must match the folder name: lowercase letters, digits and dashes. */
  id: string;
  /** Schema changes, applied in order after the base schema. Append new ones; never edit one that has run. */
  migrations?: FeatureMigration[];
  /** This feature's slice of the root snapshot (`snapshot.features[id]`). Must be JSON-serializable. */
  snapshot?: (db: DatabaseSync) => unknown;
  onWorkoutChange?: (db: DatabaseSync, event: WorkoutEvent) => void;
  onRoutineChange?: (db: DatabaseSync, event: RoutineEvent) => void;
  /** Delete this feature's rows. Called by "Reset everything" and before an import replaces all data. */
  reset?: (db: DatabaseSync) => void;
  /**
   * Restore `snapshot.features[id]` from an export. Called after the base settings, workouts and routines are in,
   * with their original ids, so ids stored in the slice still point at the right rows.
   */
  importData?: (db: DatabaseSync, data: unknown) => void;
  /** Merge demo rows in for "Load sample data". Called after the base sample routines and workouts exist. */
  loadSample?: (db: DatabaseSync) => void;
};

const modules = import.meta.glob<{ default: ServerFeature }>("../features/*/index.server.ts", { eager: true });

// Resolved lazily: feature modules import the db helpers, which import this file.
let features: ServerFeature[] | undefined;

export function serverFeatures(): ServerFeature[] {
  features ??= collectFeatures(modules, "ServerFeature");
  return features;
}

/** Swap the registered features (tests only). Pass `undefined` to go back to the real ones. */
export function setServerFeaturesForTests(list: ServerFeature[] | undefined) {
  features = list;
}

/** Tell every feature about a workout change. */
export function emitWorkout(db: DatabaseSync, event: WorkoutEvent) {
  for (const f of serverFeatures()) f.onWorkoutChange?.(db, event);
}

/** Tell every feature about a routine change. */
export function emitRoutine(db: DatabaseSync, event: RoutineEvent) {
  for (const f of serverFeatures()) f.onRoutineChange?.(db, event);
}
