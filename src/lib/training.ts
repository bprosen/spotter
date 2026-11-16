/** Training facts derived on the client (and in tests) from the snapshot: sets, volume, history, weekly totals. */
import { type Exercise, getExercise, type Measure, type Muscle } from "@/data/exercises";
import { addDays, dateOf, secondsBetween, startOfWeek, today } from "./dates";
import type { Settings, Workout, WorkoutExercise, WorkoutSet } from "./types";
import { formatDistance, formatDuration, formatWeight, roundTo } from "./units";

// ---------- single sets ----------

/** Completed working sets: the ones that count. */
export function countedSets(we: Pick<WorkoutExercise, "sets">): WorkoutSet[] {
  return we.sets.filter((s) => s.completed && s.kind === "working");
}

/** Load moved in a set, in kg. Only `weight` exercises count; bodyweight reps would make the number meaningless. */
export function setVolume(set: WorkoutSet, measure: Measure): number {
  if (measure !== "weight" || set.weightKg == null || set.reps == null) return 0;
  return set.weightKg * set.reps;
}

/**
 * Estimated one-rep max (Epley), in kg. Null when there's nothing to estimate from, or the set was so long the
 * formula stops meaning much.
 */
export function estimate1RM(weightKg: number | null, reps: number | null): number | null {
  if (weightKg == null || reps == null || reps < 1 || weightKg <= 0) return null;
  if (reps === 1) return weightKg;
  if (reps > 15) return null;
  return roundTo(weightKg * (1 + reps / 30), 2);
}

/** A comparable score for "best set" in an exercise's own terms. */
export function setScore(set: WorkoutSet, measure: Measure): number {
  switch (measure) {
    case "weight":
      return estimate1RM(set.weightKg, set.reps) ?? set.weightKg ?? 0;
    case "reps":
      return (set.reps ?? 0) + (set.weightKg ?? 0) / 1000;
    case "time":
      return set.durationS ?? 0;
    case "distance":
      return set.distanceM ?? 0;
  }
}

/** The best set among some sets, or undefined if there are none. */
export function bestSet(sets: WorkoutSet[], measure: Measure): WorkoutSet | undefined {
  let best: WorkoutSet | undefined;
  for (const s of sets) if (!best || setScore(s, measure) > setScore(best, measure)) best = s;
  return best;
}

type Units = Pick<Settings, "weightUnit" | "distanceUnit">;

/** "60 kg × 8", "12 reps", "+10 kg × 8", "1:30", "5 km in 25:00". */
export function formatSet(set: Omit<WorkoutSet, "id" | "completed" | "kind">, measure: Measure, u: Units): string {
  switch (measure) {
    case "weight":
      return `${set.weightKg == null ? "—" : formatWeight(set.weightKg, u.weightUnit)} × ${set.reps ?? "—"}`;
    case "reps":
      return set.weightKg
        ? `+${formatWeight(set.weightKg, u.weightUnit)} × ${set.reps ?? "—"}`
        : `${set.reps ?? "—"} reps`;
    case "time":
      return set.durationS == null ? "—" : formatDuration(set.durationS);
    case "distance": {
      const d = set.distanceM == null ? null : formatDistance(set.distanceM, u.distanceUnit);
      const t = set.durationS == null ? null : formatDuration(set.durationS);
      return d && t ? `${d} in ${t}` : (d ?? t ?? "—");
    }
  }
}

// ---------- workouts ----------

export function isInProgress(w: Pick<Workout, "finishedAt">): boolean {
  return w.finishedAt == null;
}

/** The workout in progress, if there is one. */
export function activeWorkout(workouts: Workout[]): Workout | undefined {
  return workouts.find(isInProgress);
}

/** Finished workouts, newest first. */
export function finishedWorkouts(workouts: Workout[]): Workout[] {
  return workouts.filter((w) => !isInProgress(w));
}

/** The exercise behind a workout line. Lines only ever hold catalog ids, but stay safe if one is removed. */
export function exerciseOf(we: Pick<WorkoutExercise, "exerciseId">): Exercise {
  return (
    getExercise(we.exerciseId) ?? {
      id: we.exerciseId,
      name: we.exerciseId,
      muscle: "chest",
      secondary: [],
      equipment: "other",
      measure: "weight",
      cue: "",
    }
  );
}

export type WorkoutStats = {
  exercises: number;
  sets: number;
  reps: number;
  /** kg moved in `weight` exercises. */
  volumeKg: number;
  distanceM: number;
  /** Null while in progress. */
  durationS: number | null;
};

export function workoutStats(w: Workout): WorkoutStats {
  let sets = 0;
  let reps = 0;
  let volumeKg = 0;
  let distanceM = 0;
  let exercises = 0;
  for (const we of w.exercises) {
    const { measure } = exerciseOf(we);
    const counted = countedSets(we);
    if (counted.length) exercises++;
    for (const s of counted) {
      sets++;
      reps += s.reps ?? 0;
      volumeKg += setVolume(s, measure);
      distanceM += s.distanceM ?? 0;
    }
  }
  return {
    exercises,
    sets,
    reps,
    volumeKg: roundTo(volumeKg, 2),
    distanceM,
    durationS: w.finishedAt ? secondsBetween(w.startedAt, w.finishedAt) : null,
  };
}

/** Muscles a workout hit with at least one counted set, as primary movers, most sets first. */
export function musclesWorked(w: Workout): Muscle[] {
  const count = new Map<Muscle, number>();
  for (const we of w.exercises) {
    const n = countedSets(we).length;
    if (!n) continue;
    const m = exerciseOf(we).muscle;
    count.set(m, (count.get(m) ?? 0) + n);
  }
  return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([m]) => m);
}

/** Default title for a workout started without a routine: "Morning workout". */
export function defaultTitle(partOfDay: string): string {
  return `${partOfDay} workout`;
}

// ---------- one exercise over time ----------

export type ExerciseSession = {
  workoutId: number;
  workoutTitle: string;
  date: string;
  startedAt: string;
  /** Completed working sets, in order. */
  sets: WorkoutSet[];
  note: string | null;
};

/** Every finished workout that has counted sets of an exercise, newest first. */
export function exerciseHistory(workouts: Workout[], exerciseId: string): ExerciseSession[] {
  const out: ExerciseSession[] = [];
  for (const w of workouts) {
    if (isInProgress(w)) continue;
    const lines = w.exercises.filter((we) => we.exerciseId === exerciseId);
    const sets = lines.flatMap(countedSets);
    if (!sets.length) continue;
    out.push({
      workoutId: w.id,
      workoutTitle: w.title,
      date: dateOf(w.startedAt),
      startedAt: w.startedAt,
      sets,
      note: lines.find((l) => l.note)?.note ?? null,
    });
  }
  return out.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

/**
 * The sets done last time, for the "previous" column while logging: completed sets (warm-ups included, so the
 * rows line up) from the most recent other workout that has any.
 */
export function previousSets(workouts: Workout[], exerciseId: string, excludeWorkoutId?: number): WorkoutSet[] {
  let best: { startedAt: string; sets: WorkoutSet[] } | undefined;
  for (const w of workouts) {
    if (w.id === excludeWorkoutId || isInProgress(w)) continue;
    const sets = w.exercises
      .filter((we) => we.exerciseId === exerciseId)
      .flatMap((we) => we.sets.filter((s) => s.completed));
    if (sets.length && (!best || w.startedAt > best.startedAt)) best = { startedAt: w.startedAt, sets };
  }
  return best?.sets ?? [];
}

// ---------- the calendar ----------

export type WeekSummary = {
  /** The first day of the week. */
  start: string;
  workouts: number;
  sets: number;
  volumeKg: number;
  durationS: number;
};

/** The last `weeks` weeks (the current one last), each with its totals. Weeks with no training are included. */
export function weekSummaries(
  workouts: Workout[],
  { weeks = 8, weekStart = 1, on = today() }: { weeks?: number; weekStart?: 0 | 1; on?: string } = {},
): WeekSummary[] {
  const current = startOfWeek(on, weekStart);
  const list: WeekSummary[] = [];
  for (let i = weeks - 1; i >= 0; i--)
    list.push({ start: addDays(current, -7 * i), workouts: 0, sets: 0, volumeKg: 0, durationS: 0 });
  const byStart = new Map(list.map((w) => [w.start, w]));
  for (const w of workouts) {
    if (isInProgress(w)) continue;
    const week = byStart.get(startOfWeek(dateOf(w.startedAt), weekStart));
    if (!week) continue;
    const s = workoutStats(w);
    week.workouts++;
    week.sets += s.sets;
    week.volumeKg = roundTo(week.volumeKg + s.volumeKg, 2);
    week.durationS += s.durationS ?? 0;
  }
  return list;
}
