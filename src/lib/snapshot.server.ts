import { all, getDb, type SettingRow } from "./db.server";
import { serverFeatures } from "./features.server";
import { listRoutines } from "./routines.server";
import { DEFAULT_SETTINGS, type Json, type Settings, type Snapshot } from "./types";
import { isDistanceUnit, isWeightUnit } from "./units";
import { listWorkouts } from "./workouts.server";

export function readSettings(): Settings {
  const m = new Map(all<SettingRow>("SELECT key, value FROM settings").map((r) => [r.key, r.value]));
  const goal = Number(m.get("weeklyGoal"));
  const weightUnit = m.get("weightUnit");
  const distanceUnit = m.get("distanceUnit");
  return {
    displayName: m.get("displayName") || DEFAULT_SETTINGS.displayName,
    weightUnit: isWeightUnit(weightUnit) ? weightUnit : DEFAULT_SETTINGS.weightUnit,
    distanceUnit: isDistanceUnit(distanceUnit) ? distanceUnit : DEFAULT_SETTINGS.distanceUnit,
    weeklyGoal: Number.isInteger(goal) && goal >= 1 && goal <= 14 ? goal : DEFAULT_SETTINGS.weeklyGoal,
    weekStart: m.get("weekStart") === "0" ? 0 : m.get("weekStart") === "1" ? 1 : DEFAULT_SETTINGS.weekStart,
  };
}

/** Read everything the UI needs in one go: the base data plus each feature's slice. */
export function readSnapshot(): Snapshot {
  const db = getDb();
  const features: Record<string, Json> = {};
  for (const f of serverFeatures()) {
    // `snapshot` is typed loosely so features can return their own row types; they must be JSON-shaped.
    if (f.snapshot) features[f.id] = (f.snapshot(db) ?? null) as Json;
  }
  return { settings: readSettings(), workouts: listWorkouts(), routines: listRoutines(), features };
}
