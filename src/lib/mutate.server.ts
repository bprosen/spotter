/** The plumbing every write goes through: a transaction, a uniform result, and input validation. */
import type { DatabaseSync } from "node:sqlite";
import { type Exercise, getExercise } from "@/data/exercises";
import { tx } from "./db.server";
import type { ActionResult } from "./types";

/** A mistake the user can fix. Its message is shown to them as-is. */
export class UserError extends Error {}

/**
 * Wrap a mutation: run it in a transaction and return a uniform result. User mistakes (`UserError`) come back
 * as `{ ok: false, error }`; anything else is logged and reported generically. Features use this for their own
 * server functions too.
 */
export async function mutate<T>(fn: (db: DatabaseSync) => T): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: tx(fn) };
  } catch (err) {
    if (err instanceof UserError) return { ok: false, error: err.message };
    console.error(err);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export function str(v: unknown, field: string, { required = false, max = 2000 } = {}): string | null {
  if (v == null || v === "") {
    if (required) throw new UserError(`${field} is required`);
    return null;
  }
  if (typeof v !== "string") throw new UserError(`${field} must be text`);
  const s = v.trim();
  if (required && !s) throw new UserError(`${field} is required`);
  if (s.length > max) throw new UserError(`${field} is too long (max ${max} characters)`);
  return s || null;
}

export function int(v: unknown, field: string, { min = 0, max = 1_000_000 } = {}): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isInteger(n)) throw new UserError(`${field} must be a whole number`);
  if (n < min || n > max) throw new UserError(`${field} must be between ${min} and ${max}`);
  return n;
}

/** A non-negative decimal (a weight, a distance), or null if blank. */
export function amount(v: unknown, field: string, { max = 100_000 } = {}): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : Number.NaN;
  if (!Number.isFinite(n)) throw new UserError(`${field} must be a number`);
  if (n < 0) throw new UserError(`${field} can't be negative`);
  if (n > max) throw new UserError(`${field} is too large`);
  return n;
}

/** An ISO-8601 timestamp, normalized to UTC ("2026-01-15T18:30:00.000Z"), or null if blank. */
export function timestamp(v: unknown, field: string): string | null {
  if (v == null || v === "") return null;
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v))
    throw new UserError(`${field} must be a valid date and time`);
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new UserError(`${field} must be a valid date and time`);
  return d.toISOString();
}

/** A valid timestamp, or null. For lenient parsing of imported data. */
export function safeTimestamp(v: unknown): string | null {
  try {
    return timestamp(v, "time");
  } catch {
    return null;
  }
}

export function exercise(v: unknown): Exercise {
  const e = typeof v === "string" ? getExercise(v) : undefined;
  if (!e) throw new UserError("Unknown exercise");
  return e;
}

/** A positive integer row id. */
export function id(v: unknown, what = "Item"): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isInteger(n) || n < 1) throw new UserError(`${what} not found`);
  return n;
}

export function bool(v: unknown, field: string): boolean {
  if (typeof v !== "boolean") throw new UserError(`${field} must be true or false`);
  return v;
}
