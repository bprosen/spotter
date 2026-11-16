/**
 * UI half of the feature registry.
 *
 * A feature lives in `src/features/<id>/` and default-exports a `Feature` from `index.ts` or `index.tsx`. It is
 * picked up automatically, with nothing to register by hand. Its pages are ordinary file routes in
 * `src/routes/`, and its database side (if any) is `index.server.ts`; see `features.server.ts`.
 *
 * This file must stay importable in the browser, so feature UI modules must never import `*.server.ts` files.
 * Talk to the server through `createServerFn` functions instead.
 */
import type { LinkProps } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import type { ComponentType } from "react";
import type { Exercise } from "@/data/exercises";
import { collectFeatures } from "./collect-features";
import type { Routine, Workout, WorkoutExercise, WorkoutSet } from "./types";

export type NavItem = {
  to: NonNullable<LinkProps["to"]>;
  label: string;
  icon: LucideIcon;
  /** Primary items sit in the main nav (and the mobile tab bar if there's room); the rest go under "More". */
  primary?: boolean;
};

/** Props for a `setRowExtras` component. `index` is the set's position in the exercise, from 0. */
export type SetRowExtraProps = {
  workout: Workout;
  line: WorkoutExercise;
  exercise: Exercise;
  set: WorkoutSet;
  index: number;
};

/** Passed to `onSetCompleted` after a set is ticked off and saved. */
export type SetCompletedInfo = {
  workout: Workout;
  line: WorkoutExercise;
  exercise: Exercise;
  set: WorkoutSet;
};

export type Feature = {
  /** Must match the folder name: lowercase letters, digits and dashes. */
  id: string;
  /** Links to this feature's pages. */
  nav?: NavItem[];
  /** Cards on the home dashboard, below the base sections, in feature-id order. */
  homeWidgets?: ComponentType[];
  /** Panels on each workout's page, below the exercises. Shown for in-progress and finished workouts. */
  workoutSections?: ComponentType<{ workout: Workout }>[];
  /** Small extras in each exercise card's header while logging (a plate calculator button, a rest-time chip…). */
  workoutExerciseActions?: ComponentType<{ workout: Workout; line: WorkoutExercise; exercise: Exercise }>[];
  /**
   * Inline extras for one set while logging (a PR badge, a target to hit…), shown on a full-width line under
   * that set's inputs. Return null to show nothing; the line takes no space when every extra is empty.
   */
  setRowExtras?: ComponentType<SetRowExtraProps>[];
  /** Panels on each routine's page, below its exercise list. */
  routineSections?: ComponentType<{ routine: Routine }>[];
  /** Panels on each catalog exercise's page, above its recent sessions. */
  exerciseSections?: ComponentType<{ exercise: Exercise }>[];
  /** Cards on the Settings page, between the profile and data cards, for the feature's own options. */
  settingsSections?: ComponentType[];
  /** Mounted once in the root layout, for dialogs, timers and other global UI. */
  overlays?: ComponentType[];
  /**
   * Called in the browser right after the user ticks off a set and it's saved, e.g. to start a rest timer.
   * Server-side reactions belong in `onWorkoutChange` instead.
   */
  onSetCompleted?: (info: SetCompletedInfo) => void;
};

const modules = import.meta.glob<{ default: Feature }>("../features/*/index.{ts,tsx}", { eager: true });

// Resolved lazily, in case a feature module imports something that imports this file.
let features: Feature[] | undefined;

export function getFeatures(): Feature[] {
  features ??= collectFeatures(modules, "Feature");
  return features;
}

type ListSlot = Exclude<keyof Feature, "id" | "onSetCompleted">;

/** Every feature's entries for one slot, flattened in feature-id order. */
export function slot<K extends ListSlot>(key: K): NonNullable<Feature[K]> {
  const out: unknown[] = [];
  for (const f of getFeatures()) out.push(...((f[key] ?? []) as unknown[]));
  return out as NonNullable<Feature[K]>;
}

/** Tell every feature a set was completed. A feature that throws is logged and skipped. */
export function emitSetCompleted(info: SetCompletedInfo) {
  for (const f of getFeatures()) {
    try {
      f.onSetCompleted?.(info);
    } catch (err) {
      console.error(`Feature "${f.id}" failed in onSetCompleted`, err);
    }
  }
}
