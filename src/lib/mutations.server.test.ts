import type { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as D from "./data.server";
import { setClockForTests } from "./dates";
import { allMigrations, appliedMigrations, BASE_MIGRATIONS, migrate, openDb, resetDbForTests } from "./db.server";
import { type RoutineEvent, type ServerFeature, setServerFeaturesForTests, type WorkoutEvent } from "./features.server";
import * as R from "./routines.server";
import { SAMPLE_ROUTINES, sampleWorkouts } from "./sample-data";
import { readSnapshot } from "./snapshot.server";
import { activeWorkout, workoutStats } from "./training";
import * as W from "./workouts.server";

let clock = new Date(2026, 0, 15, 18, 0);
const at = (h: number, m = 0) => {
  clock = new Date(2026, 0, 15, h, m);
};

beforeEach(() => {
  clock = new Date(2026, 0, 15, 18, 0);
  setClockForTests(() => clock);
  resetDbForTests();
});
afterEach(() => {
  setClockForTests(undefined);
  setServerFeaturesForTests(undefined);
});

async function ok<T>(p: Promise<{ ok: true; data?: T } | { ok: false; error: string }>): Promise<T> {
  const r = await p;
  if (!r.ok) throw new Error(`expected ok, got: ${r.error}`);
  return r.data as T;
}

async function fails(p: Promise<{ ok: boolean; error?: string }>, msg: RegExp) {
  const r = await p;
  expect(r.ok).toBe(false);
  expect(r.error).toMatch(msg);
}

const push = {
  title: "Push day",
  description: "Chest first",
  exercises: [
    { exerciseId: "bench-press", sets: 3, reps: 5 },
    { exerciseId: "plank", sets: 2, reps: null, note: "  hold tight " },
  ],
};

/** Start, log one set of bench and finish. Returns the finished workout. */
async function quickWorkout(weightKg = 100, reps = 5) {
  const w = await ok(W.startWorkoutFn({}));
  const line = await ok(W.addExerciseFn({ workoutId: w.id, exerciseId: "bench-press" }));
  await ok(W.updateSetFn({ id: line.sets[0].id, weightKg, reps, completed: true }));
  return ok(W.finishWorkoutFn({ id: w.id }));
}

describe("migrations", () => {
  it("bring a fresh database up to date, tracked by id, and are idempotent", () => {
    const db = openDb(":memory:");
    expect(appliedMigrations(db)).toEqual(BASE_MIGRATIONS.map((m) => m.id));
    migrate(db);
    expect(appliedMigrations(db)).toEqual(BASE_MIGRATIONS.map((m) => m.id));
  });

  it("apply only the migrations a database is missing", () => {
    const db = openDb(":memory:");
    const ran: string[] = [];
    const m = (id: string) => ({ id, up: () => ran.push(id) });
    migrate(db, [...BASE_MIGRATIONS, m("b/001"), m("a/001")]);
    migrate(db, [...BASE_MIGRATIONS, m("a/001"), m("c/001"), m("b/001")]);
    expect(ran).toEqual(["b/001", "a/001", "c/001"]);
  });

  it("roll back a failing migration and name it", () => {
    const db = openDb(":memory:");
    const bad = {
      id: "broken/001",
      up: (d: DatabaseSync) => {
        d.exec("CREATE TABLE half_done (x)");
        throw new Error("boom");
      },
    };
    expect(() => migrate(db, [...BASE_MIGRATIONS, bad])).toThrow(/"broken\/001" failed/);
    expect(appliedMigrations(db)).not.toContain("broken/001");
    expect(db.prepare("SELECT name FROM sqlite_master WHERE name = 'half_done'").get()).toBeUndefined();
  });

  it("namespace feature migrations by feature id and reject duplicates", () => {
    const up = () => {};
    const f = (id: string, ...names: string[]): ServerFeature => ({
      id,
      migrations: names.map((name) => ({ name, up })),
    });
    expect(allMigrations([f("body-weight", "001"), f("prs", "001")]).map((m) => m.id)).toEqual([
      ...BASE_MIGRATIONS.map((m) => m.id),
      "body-weight/001",
      "prs/001",
    ]);
    expect(() => allMigrations([f("prs", "001", "001")])).toThrow(/Duplicate migration "prs\/001"/);
  });
});

describe("workouts", () => {
  it("start empty with a title from the time of day, and only one at a time", async () => {
    at(7, 30);
    const w = await ok(W.startWorkoutFn({}));
    expect(w.title).toBe("Morning workout");
    expect(w.finishedAt).toBeNull();
    expect(w.exercises).toEqual([]);
    await fails(W.startWorkoutFn({}), /Finish or discard/);
  });

  it("add exercises with one blank set the first time, and last time's sets after that", async () => {
    await quickWorkout(100, 5);
    const w = await ok(W.startWorkoutFn({}));
    const bench = await ok(W.addExerciseFn({ workoutId: w.id, exerciseId: "bench-press" }));
    expect(bench.sets).toHaveLength(1);
    expect(bench.sets[0]).toMatchObject({ weightKg: 100, reps: 5, completed: false, kind: "working" });
    const squat = await ok(W.addExerciseFn({ workoutId: w.id, exerciseId: "back-squat" }));
    expect(squat.sets[0]).toMatchObject({ weightKg: null, reps: null, completed: false });
    await fails(W.addExerciseFn({ workoutId: w.id, exerciseId: "moon-press" }), /Unknown exercise/);
  });

  it("add sets copying the last one, and renumber after removing", async () => {
    const w = await ok(W.startWorkoutFn({}));
    const line = await ok(W.addExerciseFn({ workoutId: w.id, exerciseId: "bench-press" }));
    await ok(W.updateSetFn({ id: line.sets[0].id, kind: "warmup", weightKg: 40, reps: 10 }));
    const second = await ok(W.addSetFn({ lineId: line.id }));
    expect(second).toMatchObject({ kind: "working", weightKg: 40, reps: 10, completed: false });
    const third = await ok(W.addSetFn({ lineId: line.id }));
    await ok(W.removeSetFn({ id: second.id }));
    const after = W.getWorkout(w.id)!.exercises[0].sets;
    expect(after.map((s) => s.id)).toEqual([line.sets[0].id, third.id]);
  });

  it("refuse to tick off a set without the numbers its exercise needs", async () => {
    const w = await ok(W.startWorkoutFn({}));
    const bench = await ok(W.addExerciseFn({ workoutId: w.id, exerciseId: "bench-press" }));
    await fails(W.updateSetFn({ id: bench.sets[0].id, reps: 5, completed: true }), /Enter a weight/);
    await fails(W.updateSetFn({ id: bench.sets[0].id, weightKg: 60, completed: true }), /Enter the reps/);
    const plank = await ok(W.addExerciseFn({ workoutId: w.id, exerciseId: "plank" }));
    await fails(W.updateSetFn({ id: plank.sets[0].id, completed: true }), /Enter a time/);
    await ok(W.updateSetFn({ id: plank.sets[0].id, durationS: 60, completed: true }));
    const run = await ok(W.addExerciseFn({ workoutId: w.id, exerciseId: "run" }));
    await fails(W.updateSetFn({ id: run.sets[0].id, completed: true }), /distance or time/);
    const pullUp = await ok(W.addExerciseFn({ workoutId: w.id, exerciseId: "pull-up" }));
    await ok(W.updateSetFn({ id: pullUp.sets[0].id, reps: 8, completed: true }));
  });

  it("validate set numbers", async () => {
    const w = await ok(W.startWorkoutFn({}));
    const line = await ok(W.addExerciseFn({ workoutId: w.id, exerciseId: "bench-press" }));
    const id = line.sets[0].id;
    await fails(W.updateSetFn({ id, weightKg: -5 }), /can't be negative/);
    await fails(W.updateSetFn({ id, reps: 2.5 }), /whole number/);
    await fails(W.updateSetFn({ id, kind: "drop" }), /warm-up or working/);
    await fails(W.updateSetFn({ id, completed: "yes" }), /true or false/);
    await fails(W.updateSetFn({ id: 9999 }), /Set not found/);
  });

  it("finish by dropping unticked sets and empty exercises, and refuse when nothing was done", async () => {
    at(18, 0);
    const w = await ok(W.startWorkoutFn({}));
    await fails(W.finishWorkoutFn({ id: w.id }), /Tick off at least one set/);
    const bench = await ok(W.addExerciseFn({ workoutId: w.id, exerciseId: "bench-press" }));
    await ok(W.addExerciseFn({ workoutId: w.id, exerciseId: "back-squat" }));
    const extra = await ok(W.addSetFn({ lineId: bench.id }));
    await ok(W.updateSetFn({ id: extra.id, weightKg: 80, reps: 5, completed: true }));
    at(19, 5);
    const done = await ok(W.finishWorkoutFn({ id: w.id, note: "Good one" }));
    expect(done.finishedAt).toBe(new Date(2026, 0, 15, 19, 5).toISOString());
    expect(done.note).toBe("Good one");
    expect(done.exercises.map((l) => l.exerciseId)).toEqual(["bench-press"]);
    expect(done.exercises[0].sets).toHaveLength(1);
    expect(workoutStats(done)).toMatchObject({ sets: 1, volumeKg: 400, durationS: 65 * 60 });
    await fails(W.finishWorkoutFn({ id: w.id }), /already finished/);
  });

  it("move and remove exercises, keeping positions tidy", async () => {
    const w = await ok(W.startWorkoutFn({}));
    const a = await ok(W.addExerciseFn({ workoutId: w.id, exerciseId: "bench-press" }));
    const b = await ok(W.addExerciseFn({ workoutId: w.id, exerciseId: "back-squat" }));
    const c = await ok(W.addExerciseFn({ workoutId: w.id, exerciseId: "deadlift" }));
    await ok(W.moveExerciseFn({ lineId: c.id, by: -1 }));
    await ok(W.moveExerciseFn({ lineId: a.id, by: -1 }));
    expect(W.getWorkout(w.id)!.exercises.map((l) => l.id)).toEqual([a.id, c.id, b.id]);
    await ok(W.removeExerciseFn({ lineId: a.id }));
    await ok(W.moveExerciseFn({ lineId: b.id, by: -1 }));
    expect(W.getWorkout(w.id)!.exercises.map((l) => l.id)).toEqual([b.id, c.id]);
    await ok(W.editExerciseNoteFn({ lineId: b.id, note: "  low bar  " }));
    expect(W.getWorkout(w.id)!.exercises[0].note).toBe("low bar");
  });

  it("log past workouts as already finished, and keep edits in order", async () => {
    const past = await ok(
      W.logPastWorkoutFn({ startedAt: "2026-01-10T17:00:00.000Z", finishedAt: "2026-01-10T18:00:00.000Z" }),
    );
    expect(past.finishedAt).toBe("2026-01-10T18:00:00.000Z");
    await fails(
      W.logPastWorkoutFn({ startedAt: "2026-01-10T18:00:00.000Z", finishedAt: "2026-01-10T17:00:00.000Z" }),
      /end before it starts/,
    );
    await fails(
      W.logPastWorkoutFn({ startedAt: "2027-01-10T18:00:00.000Z", finishedAt: "2027-01-10T19:00:00.000Z" }),
      /hasn't happened yet/,
    );
    const edited = await ok(W.updateWorkoutFn({ id: past.id, title: "Gym", finishedAt: "2026-01-10T18:30:00Z" }));
    expect(edited).toMatchObject({ title: "Gym", finishedAt: "2026-01-10T18:30:00.000Z" });
    await fails(W.updateWorkoutFn({ id: past.id, title: "  " }), /Title is required/);
    // A past workout doesn't block starting a live one.
    const live = await ok(W.startWorkoutFn({}));
    await fails(W.updateWorkoutFn({ id: live.id, finishedAt: "2026-01-15T19:00:00Z" }), /Finish the workout/);
  });

  it("delete a workout and everything in it", async () => {
    const w = await quickWorkout();
    await ok(W.deleteWorkoutFn({ id: w.id }));
    expect(readSnapshot().workouts).toEqual([]);
    await fails(W.deleteWorkoutFn({ id: w.id }), /Workout not found/);
  });
});

describe("routines", () => {
  it("create, normalise and validate", async () => {
    const r = await ok(R.createRoutineFn(push));
    expect(r.exercises).toEqual([
      { exerciseId: "bench-press", sets: 3, reps: 5, note: null },
      { exerciseId: "plank", sets: 2, reps: null, note: "hold tight" },
    ]);
    await fails(R.createRoutineFn({ ...push, exercises: [] }), /at least one exercise/);
    await fails(R.createRoutineFn({ ...push, title: "" }), /Title is required/);
    await fails(
      R.createRoutineFn({ ...push, exercises: [{ exerciseId: "bench-press", sets: 0 }] }),
      /between 1 and 20/,
    );
  });

  it("lay out a started workout with the routine's targets and last time's weights", async () => {
    await quickWorkout(102.5, 4);
    const r = await ok(R.createRoutineFn(push));
    const w = await ok(W.startWorkoutFn({ routineId: r.id }));
    expect(w.title).toBe("Push day");
    expect(w.routineId).toBe(r.id);
    expect(w.exercises.map((l) => [l.exerciseId, l.sets.length, l.note])).toEqual([
      ["bench-press", 3, null],
      ["plank", 2, "hold tight"],
    ]);
    expect(w.exercises[0].sets.every((s) => s.weightKg === 102.5 && s.reps === 5 && !s.completed)).toBe(true);
  });

  it("edit and delete; workouts outlive their routine", async () => {
    const r = await ok(R.createRoutineFn(push));
    const edited = await ok(
      R.updateRoutineFn({ id: r.id, title: "Push", exercises: [{ exerciseId: "dip", sets: 4 }] }),
    );
    expect(edited.exercises).toEqual([{ exerciseId: "dip", sets: 4, reps: null, note: null }]);
    const w = await ok(W.startWorkoutFn({ routineId: r.id }));
    await ok(R.deleteRoutineFn({ id: r.id }));
    expect(W.getWorkout(w.id)).toMatchObject({ routineId: null, title: "Push" });
    await fails(W.deleteWorkoutFn({ id: 999 }), /not found/);
  });

  it("save a workout as a routine", async () => {
    const w = await ok(W.startWorkoutFn({ title: "Arms" }));
    const curl = await ok(W.addExerciseFn({ workoutId: w.id, exerciseId: "dumbbell-curl" }));
    await ok(W.updateSetFn({ id: curl.sets[0].id, kind: "warmup", weightKg: 8, reps: 12, completed: true }));
    for (const reps of [10, 10, 8]) {
      const s = await ok(W.addSetFn({ lineId: curl.id }));
      await ok(W.updateSetFn({ id: s.id, kind: "working", weightKg: 14, reps, completed: true }));
    }
    const r = await ok(R.routineFromWorkoutFn({ workoutId: w.id }));
    expect(r.title).toBe("Arms");
    expect(r.exercises).toEqual([{ exerciseId: "dumbbell-curl", sets: 3, reps: 10, note: null }]);
  });
});

describe("feature hooks", () => {
  it("hear about workout and routine changes inside the transaction", async () => {
    const seen: string[] = [];
    setServerFeaturesForTests([
      {
        id: "spy",
        onWorkoutChange: (_db, e: WorkoutEvent) => seen.push(`w:${e.type}`),
        onRoutineChange: (_db, e: RoutineEvent) => seen.push(`r:${e.type}`),
      },
    ]);
    const r = await ok(R.createRoutineFn(push));
    const w = await ok(W.startWorkoutFn({ routineId: r.id }));
    await ok(W.updateSetFn({ id: w.exercises[0].sets[0].id, weightKg: 60, completed: true }));
    await ok(W.updateSetFn({ id: w.exercises[0].sets[0].id, reps: 6 }));
    await ok(W.finishWorkoutFn({ id: w.id }));
    await ok(W.deleteWorkoutFn({ id: w.id }));
    await ok(R.deleteRoutineFn({ id: r.id }));
    expect(seen).toEqual([
      "r:created",
      "w:started",
      "w:set-completed",
      "w:updated",
      "w:finished",
      "w:deleted",
      "r:deleted",
    ]);
  });

  it("roll the whole mutation back when a hook throws", async () => {
    setServerFeaturesForTests([
      {
        id: "grumpy",
        onWorkoutChange: (_db, e) => {
          if (e.type === "finished") throw new Error("nope");
        },
      },
    ]);
    const w = await ok(W.startWorkoutFn({}));
    const line = await ok(W.addExerciseFn({ workoutId: w.id, exerciseId: "bench-press" }));
    await ok(W.updateSetFn({ id: line.sets[0].id, weightKg: 60, reps: 5, completed: true }));
    await fails(W.finishWorkoutFn({ id: w.id }), /Something went wrong/);
    expect(W.getWorkout(w.id)!.finishedAt).toBeNull();
  });
});

describe("settings, sample data, import and reset", () => {
  it("save settings with validation", async () => {
    await ok(
      D.saveSettings({ displayName: "Alex", weightUnit: "lb", distanceUnit: "mi", weeklyGoal: 4, weekStart: 0 }),
    );
    expect(readSnapshot().settings).toEqual({
      displayName: "Alex",
      weightUnit: "lb",
      distanceUnit: "mi",
      weeklyGoal: 4,
      weekStart: 0,
    });
    await fails(D.saveSettings({ weightUnit: "stone" }), /kg or lb/);
    await fails(D.saveSettings({ weeklyGoal: 0 }), /between 1 and 14/);
  });

  it("load sample data once, however many times it's asked", async () => {
    await ok(D.loadSampleData());
    await ok(D.loadSampleData());
    const s = readSnapshot();
    expect(s.routines.map((r) => r.title)).toEqual(SAMPLE_ROUTINES.map((r) => r.title).sort());
    expect(s.workouts).toHaveLength(sampleWorkouts().length);
    expect(activeWorkout(s.workouts)).toBeUndefined();
    expect(s.settings.displayName).toBe("Sam");
  });

  it("round-trip an export through import, keeping ids, and drop junk", async () => {
    await ok(D.loadSampleData());
    await ok(W.startWorkoutFn({}));
    const before = readSnapshot();
    const junk = {
      ...before,
      workouts: [...before.workouts, { id: "x" }, { id: 999, startedAt: "nonsense" }],
      routines: [...before.routines, { id: 500, title: "Bad", exercises: [{ exerciseId: "nope", sets: 3 }] }],
    };
    await ok(D.importData({ snapshot: junk }));
    const after = readSnapshot();
    expect(after.workouts).toEqual(before.workouts);
    expect(after.routines.filter((r) => r.id !== 500)).toEqual(before.routines);
    expect(after.routines.find((r) => r.id === 500)?.exercises).toEqual([]);
    await fails(D.importData({ snapshot: { hello: 1 } }), /doesn't look like a Spotter export/);
  });

  it("reset everything, including feature tables", async () => {
    let resets = 0;
    setServerFeaturesForTests([{ id: "spy", reset: () => resets++ }]);
    await ok(D.loadSampleData());
    await ok(D.resetAll());
    const s = readSnapshot();
    expect(s.workouts).toEqual([]);
    expect(s.routines).toEqual([]);
    expect(resets).toBe(1);
  });
});
