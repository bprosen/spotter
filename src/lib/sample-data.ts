/**
 * Demo data for "Load sample data": a push/pull/legs split and six weeks of steadily progressing workouts that
 * follow it, plus a few runs. Dates are relative to today so the dashboard always looks lived-in.
 */
import type { SetKind } from "./types";

export type SampleRoutine = {
  title: string;
  description: string;
  exercises: { exerciseId: string; sets: number; reps: number | null; note?: string }[];
};

export const SAMPLE_ROUTINES: SampleRoutine[] = [
  {
    title: "Push",
    description: "Chest, shoulders and triceps. Heavy press first, then accessories.",
    exercises: [
      { exerciseId: "bench-press", sets: 4, reps: 6, note: "One warm-up set at half weight" },
      { exerciseId: "overhead-press", sets: 3, reps: 8 },
      { exerciseId: "incline-dumbbell-press", sets: 3, reps: 10 },
      { exerciseId: "lateral-raise", sets: 3, reps: 15 },
      { exerciseId: "triceps-pushdown", sets: 3, reps: 12 },
    ],
  },
  {
    title: "Pull",
    description: "Back and biceps. Deadlift is the only heavy thing; keep the rest crisp.",
    exercises: [
      { exerciseId: "deadlift", sets: 3, reps: 5, note: "One warm-up set at half weight" },
      { exerciseId: "pull-up", sets: 3, reps: null },
      { exerciseId: "barbell-row", sets: 3, reps: 8 },
      { exerciseId: "face-pull", sets: 3, reps: 15 },
      { exerciseId: "dumbbell-curl", sets: 3, reps: 10 },
    ],
  },
  {
    title: "Legs",
    description: "Squat day. Finish with a plank so the core gets some too.",
    exercises: [
      { exerciseId: "back-squat", sets: 4, reps: 6, note: "One warm-up set at half weight" },
      { exerciseId: "romanian-deadlift", sets: 3, reps: 8 },
      { exerciseId: "leg-press", sets: 3, reps: 12 },
      { exerciseId: "lying-leg-curl", sets: 3, reps: 12 },
      { exerciseId: "standing-calf-raise", sets: 3, reps: 15 },
      { exerciseId: "plank", sets: 2, reps: null },
    ],
  },
];

export type SampleSet = {
  kind: SetKind;
  weightKg: number | null;
  reps: number | null;
  durationS: number | null;
  distanceM: number | null;
};

export type SampleWorkout = {
  title: string;
  /** Title of the routine it follows, if any. */
  routine: string | null;
  daysAgo: number;
  /** Local hour it started. */
  hour: number;
  minutes: number;
  note: string | null;
  exercises: { exerciseId: string; sets: SampleSet[] }[];
};

/** Where each lift starts six weeks ago and how much it goes up per session. */
const PROGRESSION: Record<string, { start: number; step: number; reps?: number[] }> = {
  "bench-press": { start: 60, step: 2.5 },
  "overhead-press": { start: 37.5, step: 1.25 },
  "incline-dumbbell-press": { start: 20, step: 1 },
  "lateral-raise": { start: 8, step: 0.5 },
  "triceps-pushdown": { start: 25, step: 1.25 },
  deadlift: { start: 100, step: 5 },
  "pull-up": { start: 0, step: 0, reps: [6, 6, 7, 7, 8, 8] },
  "barbell-row": { start: 55, step: 2.5 },
  "face-pull": { start: 20, step: 1.25 },
  "dumbbell-curl": { start: 12, step: 1 },
  "back-squat": { start: 80, step: 5 },
  "romanian-deadlift": { start: 70, step: 2.5 },
  "leg-press": { start: 140, step: 10 },
  "lying-leg-curl": { start: 35, step: 2.5 },
  "standing-calf-raise": { start: 60, step: 5 },
  plank: { start: 0, step: 0 },
};

/** Days ago for each lifting session, oldest first: three a week, Push → Pull → Legs. */
const LIFT_DAYS = [40, 38, 36, 33, 31, 29, 26, 24, 22, 19, 17, 15, 12, 10, 8, 5, 3, 1];
const RUN_DAYS = [34, 27, 20, 13, 6];

const roundToPlate = (kg: number) => Math.round(kg / 1.25) * 1.25;

function liftSets(exerciseId: string, sets: number, reps: number | null, session: number, warmup: boolean) {
  const p = PROGRESSION[exerciseId];
  const out: SampleSet[] = [];
  const weight = p ? roundToPlate(p.start + p.step * session) : 0;
  if (warmup && weight > 0)
    out.push({ kind: "warmup", weightKg: roundToPlate(weight / 2), reps: 8, durationS: null, distanceM: null });
  for (let i = 0; i < sets; i++) {
    if (exerciseId === "plank") {
      out.push({ kind: "working", weightKg: null, reps: null, durationS: 45 + session * 5, distanceM: null });
      continue;
    }
    const baseReps = reps ?? p?.reps?.[session] ?? 8;
    // The last set of a heavy lift sometimes falls a rep short, like real life.
    const r = i === sets - 1 && session % 2 === 1 ? Math.max(1, baseReps - 1) : baseReps;
    out.push({ kind: "working", weightKg: weight > 0 ? weight : null, reps: r, durationS: null, distanceM: null });
  }
  return out;
}

export function sampleWorkouts(): SampleWorkout[] {
  const out: SampleWorkout[] = [];
  LIFT_DAYS.forEach((daysAgo, i) => {
    const routine = SAMPLE_ROUTINES[i % 3];
    const session = Math.floor(i / 3);
    out.push({
      title: routine.title,
      routine: routine.title,
      daysAgo,
      hour: i % 4 === 0 ? 7 : 18,
      minutes: 50 + routine.exercises.length * 3 + (i % 3) * 4,
      note: session === 5 && routine.title === "Legs" ? "Squats felt fast today." : null,
      exercises: routine.exercises.map((e) => ({
        exerciseId: e.exerciseId,
        sets: liftSets(e.exerciseId, e.sets, e.reps, session, Boolean(e.note?.includes("warm-up"))),
      })),
    });
  });
  RUN_DAYS.forEach((daysAgo, i) => {
    const km = 5 + (i % 2) * 2;
    out.push({
      title: "Easy run",
      routine: null,
      daysAgo,
      hour: 8,
      minutes: Math.round(km * 5.8),
      note: null,
      exercises: [
        {
          exerciseId: "run",
          sets: [
            {
              kind: "working",
              weightKg: null,
              reps: null,
              distanceM: km * 1000,
              durationS: Math.round(km * (348 - i * 4)),
            },
          ],
        },
      ],
    });
  });
  return out;
}

export const SAMPLE_SETTINGS = { displayName: "Sam" };
