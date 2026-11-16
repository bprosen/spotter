import { describe, expect, it } from "vitest";
import { EXERCISES, getExercise, MUSCLE_IDS, musclesOf } from "@/data/exercises";
import { addDays, daysBetween, startOfWeek } from "./dates";
import {
  bestSet,
  estimate1RM,
  exerciseHistory,
  formatSet,
  previousSets,
  weekSummaries,
  workoutStats,
} from "./training";
import type { Workout, WorkoutSet } from "./types";
import {
  formatDistance,
  formatDuration,
  formatVolume,
  formatWeight,
  fromKg,
  parseDuration,
  toKg,
  toMetres,
} from "./units";

let nextId = 1;
const set = (p: Partial<WorkoutSet>): WorkoutSet => ({
  id: nextId++,
  kind: "working",
  weightKg: null,
  reps: null,
  durationS: null,
  distanceM: null,
  completed: true,
  ...p,
});

/** A finished workout on a date (local noon), lasting an hour. */
function workout(date: string, lines: [string, WorkoutSet[]][], over: Partial<Workout> = {}): Workout {
  const start = new Date(`${date}T12:00:00`);
  return {
    id: nextId++,
    title: "W",
    routineId: null,
    startedAt: start.toISOString(),
    finishedAt: new Date(start.getTime() + 3_600_000).toISOString(),
    note: null,
    exercises: lines.map(([exerciseId, sets]) => ({ id: nextId++, exerciseId, note: null, sets })),
    createdAt: start.toISOString(),
    updatedAt: start.toISOString(),
    ...over,
  };
}

const units = { weightUnit: "kg", distanceUnit: "km" } as const;

describe("catalog", () => {
  it("has unique kebab-case ids and valid muscles", () => {
    const ids = EXERCISES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of EXERCISES) {
      expect(e.id).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(MUSCLE_IDS).toContain(e.muscle);
      for (const m of e.secondary) expect(MUSCLE_IDS).toContain(m);
      expect(e.cue.length).toBeGreaterThan(0);
    }
  });

  it("lists primary muscle first without duplicates", () => {
    expect(musclesOf(getExercise("bench-press")!)).toEqual(["chest", "triceps", "shoulders"]);
  });

  it("covers every muscle with at least two exercises", () => {
    for (const m of MUSCLE_IDS) expect(EXERCISES.filter((e) => e.muscle === m).length).toBeGreaterThanOrEqual(2);
  });
});

describe("units", () => {
  it("convert weights both ways without drift", () => {
    expect(fromKg(toKg(135, "lb"), "lb")).toBe(135);
    expect(fromKg(100, "lb")).toBe(220.46);
    expect(toKg(62.5, "kg")).toBe(62.5);
  });

  it("format weights, distances and volume", () => {
    expect(formatWeight(62.5, "kg")).toBe("62.5 kg");
    expect(formatWeight(toKg(225, "lb"), "lb")).toBe("225 lb");
    expect(formatDistance(toMetres(3.1, "mi"), "mi")).toBe("3.1 mi");
    expect(formatVolume(12_450, "kg")).toBe("12.5 t");
    expect(formatVolume(4_250, "kg")).toBe("4,250 kg");
  });

  it("parse and format durations", () => {
    expect(parseDuration("90")).toBe(90);
    expect(parseDuration("1:30")).toBe(90);
    expect(parseDuration("1:02:05")).toBe(3725);
    expect(parseDuration("2m 30s")).toBe(150);
    expect(parseDuration("1h")).toBe(3600);
    expect(parseDuration("1:75")).toBeNull();
    expect(parseDuration("0")).toBeNull();
    expect(parseDuration("soon")).toBeNull();
    expect(formatDuration(45)).toBe("45s");
    expect(formatDuration(90)).toBe("1:30");
    expect(formatDuration(3725)).toBe("1:02:05");
  });
});

describe("dates", () => {
  it("find the start of the week on Monday or Sunday", () => {
    // 2026-01-15 is a Thursday.
    expect(startOfWeek("2026-01-15", 1)).toBe("2026-01-12");
    expect(startOfWeek("2026-01-15", 0)).toBe("2026-01-11");
    expect(startOfWeek("2026-01-12", 1)).toBe("2026-01-12");
    expect(daysBetween("2026-03-01", addDays("2026-03-01", 30))).toBe(30);
  });
});

describe("sets and workouts", () => {
  it("estimate one-rep maxes sensibly", () => {
    expect(estimate1RM(100, 1)).toBe(100);
    expect(estimate1RM(100, 5)).toBe(116.67);
    expect(estimate1RM(100, 20)).toBeNull();
    expect(estimate1RM(null, 5)).toBeNull();
  });

  it("pick the best set in the exercise's own terms", () => {
    const heavy = set({ weightKg: 100, reps: 3 });
    const volume = set({ weightKg: 80, reps: 10 });
    expect(bestSet([heavy, volume], "weight")).toBe(heavy); // e1RM 110 vs 106.67
    expect(bestSet([set({ reps: 8 }), set({ reps: 12 })], "reps")?.reps).toBe(12);
  });

  it("format sets for each measure", () => {
    expect(formatSet(set({ weightKg: 60, reps: 8 }), "weight", units)).toBe("60 kg × 8");
    expect(formatSet(set({ reps: 12 }), "reps", units)).toBe("12 reps");
    expect(formatSet(set({ weightKg: 10, reps: 8 }), "reps", units)).toBe("+10 kg × 8");
    expect(formatSet(set({ durationS: 90 }), "time", units)).toBe("1:30");
    expect(formatSet(set({ distanceM: 5000, durationS: 1500 }), "distance", units)).toBe("5 km in 25:00");
  });

  it("count only completed working sets, and only weighted exercises toward volume", () => {
    const w = workout("2026-01-10", [
      [
        "bench-press",
        [
          set({ kind: "warmup", weightKg: 40, reps: 10 }),
          set({ weightKg: 80, reps: 5 }),
          set({ weightKg: 80, reps: 5, completed: false }),
        ],
      ],
      ["pull-up", [set({ reps: 10 })]],
      ["run", [set({ distanceM: 5000, durationS: 1500 })]],
    ]);
    expect(workoutStats(w)).toEqual({
      exercises: 3,
      sets: 3,
      reps: 15,
      volumeKg: 400,
      distanceM: 5000,
      durationS: 3600,
    });
  });
});

describe("history", () => {
  const w1 = workout("2026-01-01", [["bench-press", [set({ weightKg: 80, reps: 5 }), set({ weightKg: 80, reps: 5 })]]]);
  const w2 = workout("2026-01-05", [
    ["bench-press", [set({ weightKg: 85, reps: 3 }), set({ weightKg: 70, reps: 10 })]],
  ]);
  const live = workout("2026-01-08", [["bench-press", [set({ weightKg: 200, reps: 1 })]]], { finishedAt: null });
  const all = [live, w2, w1];

  it("list sessions newest first, ignoring the workout in progress", () => {
    expect(exerciseHistory(all, "bench-press").map((s) => s.workoutId)).toEqual([w2.id, w1.id]);
    expect(previousSets(all, "bench-press", w2.id).map((s) => s.weightKg)).toEqual([80, 80]);
    expect(previousSets(all, "squat")).toEqual([]);
  });
});

describe("the calendar", () => {
  const on = "2026-01-15"; // Thursday; weeks start Monday the 12th.
  const ws = [
    workout("2026-01-13", [["back-squat", [set({ weightKg: 100, reps: 5 })]]]),
    workout("2026-01-14", [["bench-press", [set({ weightKg: 80, reps: 5 })]]]),
    workout("2026-01-06", [["bench-press", [set({ weightKg: 80, reps: 5 })]]]),
    workout("2026-01-07", [["deadlift", [set({ weightKg: 140, reps: 5 })]]]),
    workout("2025-12-30", [["deadlift", [set({ weightKg: 140, reps: 5 })]]]),
  ];

  it("summarise recent weeks, including empty ones", () => {
    const weeks = weekSummaries(ws, { weeks: 4, on });
    expect(weeks.map((w) => [w.start, w.workouts])).toEqual([
      ["2025-12-22", 0],
      ["2025-12-29", 1],
      ["2026-01-05", 2],
      ["2026-01-12", 2],
    ]);
    expect(weeks[3].volumeKg).toBe(900);
  });
});
