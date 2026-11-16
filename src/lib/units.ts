/**
 * Units and number formatting. The database always stores kilograms, metres and seconds; the user's settings
 * only change how values are shown and typed.
 */

export type WeightUnit = "kg" | "lb";
export type DistanceUnit = "km" | "mi";

export const WEIGHT_UNITS: WeightUnit[] = ["kg", "lb"];
export const DISTANCE_UNITS: DistanceUnit[] = ["km", "mi"];

export const KG_PER_LB = 0.45359237;
export const M_PER_MI = 1609.344;

export function isWeightUnit(v: unknown): v is WeightUnit {
  return v === "kg" || v === "lb";
}

export function isDistanceUnit(v: unknown): v is DistanceUnit {
  return v === "km" || v === "mi";
}

export function roundTo(n: number, places: number): number {
  const f = 10 ** places;
  return Math.round(n * f) / f;
}

/** A stored weight in the user's unit, rounded for display and editing. */
export function fromKg(kg: number, unit: WeightUnit): number {
  return roundTo(unit === "kg" ? kg : kg / KG_PER_LB, 2);
}

/** A typed weight in the user's unit, converted for storage. */
export function toKg(value: number, unit: WeightUnit): number {
  return roundTo(unit === "kg" ? value : value * KG_PER_LB, 6);
}

/** A stored distance in the user's unit. */
export function fromMetres(m: number, unit: DistanceUnit): number {
  return roundTo(unit === "km" ? m / 1000 : m / M_PER_MI, 3);
}

/** A typed distance in the user's unit, converted for storage. */
export function toMetres(value: number, unit: DistanceUnit): number {
  return roundTo(unit === "km" ? value * 1000 : value * M_PER_MI, 3);
}

/** "1,250", "62.5", "0.75": at most `places` decimals, no trailing zeros, grouped thousands. */
export function formatNumber(n: number, places = 1): string {
  return roundTo(n, places).toLocaleString("en-US", { maximumFractionDigits: places });
}

/** "62.5 kg", "135 lb". */
export function formatWeight(kg: number, unit: WeightUnit): string {
  return `${formatNumber(fromKg(kg, unit), unit === "kg" ? 2 : 1)} ${unit}`;
}

/** "5 km", "3.1 mi". */
export function formatDistance(m: number, unit: DistanceUnit): string {
  return `${formatNumber(fromMetres(m, unit), 2)} ${unit}`;
}

/** Large tonnage reads better rounded: "12,450 kg", "1.2 t" past 10 tonnes. */
export function formatVolume(kg: number, unit: WeightUnit): string {
  const v = fromKg(kg, unit);
  if (unit === "kg" && v >= 10_000) return `${formatNumber(v / 1000, 1)} t`;
  return `${formatNumber(v, 0)} ${unit}`;
}

/** Seconds as "45s", "1:30", "1:02:05". */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  if (m > 0) return `${m}:${String(sec).padStart(2, "0")}`;
  return `${sec}s`;
}

/** Long durations in words: "45 min", "1 h 20 min". */
export function formatMinutes(totalSeconds: number): string {
  const mins = Math.round(totalSeconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/**
 * Parse a typed duration: "90" (seconds), "1:30", "1:02:05", "2m", "1h 5m", "45s". Returns null for anything
 * else, including zero.
 */
export function parseDuration(text: string): number | null {
  const t = text.trim().toLowerCase();
  if (!t) return null;
  let total: number;
  if (/^\d+(\.\d+)?$/.test(t)) total = Number(t);
  else if (/^\d+(:\d{1,2}){1,2}$/.test(t)) {
    const parts = t.split(":").map(Number);
    if (parts.slice(1).some((p) => p >= 60)) return null;
    total = parts.reduce((acc, p) => acc * 60 + p, 0);
  } else {
    const m = t.match(/^(?:(\d+)\s*h)?\s*(?:(\d+)\s*m(?:in)?)?\s*(?:(\d+)\s*s(?:ec)?)?$/);
    if (!m || (!m[1] && !m[2] && !m[3])) return null;
    total = Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
  }
  total = Math.round(total);
  return total > 0 ? total : null;
}

/** "1 set", "3 sets". */
export function plural(n: number, word: string, many = `${word}s`): string {
  return `${formatNumber(n, 0)} ${n === 1 ? word : many}`;
}
