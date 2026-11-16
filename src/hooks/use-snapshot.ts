import { getRouteApi } from "@tanstack/react-router";
import { useMemo } from "react";
import { today } from "@/lib/dates";
import { activeWorkout, finishedWorkouts } from "@/lib/training";

const root = getRouteApi("__root__");

/** The user's whole dataset, loaded once by the root route and refreshed after every mutation. */
export function useSnapshot() {
  return root.useLoaderData();
}

/** Snapshot plus the lookups most pages need, memoised per snapshot. */
export function useTraining() {
  const snapshot = useSnapshot();
  return useMemo(() => {
    return {
      snapshot,
      settings: snapshot.settings,
      today: today(),
      active: activeWorkout(snapshot.workouts),
      finished: finishedWorkouts(snapshot.workouts),
      workoutById: new Map(snapshot.workouts.map((w) => [w.id, w])),
      routineById: new Map(snapshot.routines.map((r) => [r.id, r])),
    };
  }, [snapshot]);
}

/**
 * A feature's slice of the snapshot: whatever its `ServerFeature.snapshot` returned, refreshed after every
 * mutation. Undefined if the feature has no server side.
 */
export function useFeatureData<T>(id: string): T | undefined {
  return useSnapshot().features[id] as T | undefined;
}
