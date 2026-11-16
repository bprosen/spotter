import { Check, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import type { Exercise } from "@/data/exercises";
import { slot } from "@/lib/features";
import type { SetFields } from "@/lib/server-fns";
import { formatSet } from "@/lib/training";
import type { Settings, Workout, WorkoutExercise, WorkoutSet } from "@/lib/types";
import { formatDuration, fromKg, fromMetres, parseDuration, toKg, toMetres } from "@/lib/units";
import { cn } from "@/lib/utils";

type Field = "weight" | "reps" | "duration" | "distance";
type Draft = Record<Field, string>;

function toDraft(s: Pick<WorkoutSet, "weightKg" | "reps" | "durationS" | "distanceM">, u: Settings): Draft {
  return {
    weight: s.weightKg == null ? "" : String(fromKg(s.weightKg, u.weightUnit)),
    reps: s.reps == null ? "" : String(s.reps),
    duration: s.durationS == null ? "" : formatDuration(s.durationS),
    distance: s.distanceM == null ? "" : String(fromMetres(s.distanceM, u.distanceUnit)),
  };
}

/** Turn one typed field into the server's units. Throws a readable message for nonsense. */
function parseField(field: Field, text: string, u: Settings): Partial<SetFields> {
  const t = text.trim();
  if (field === "duration") {
    if (!t) return { durationS: null };
    const s = parseDuration(t);
    if (s == null) throw new Error("Times look like 45, 1:30 or 2m 30s");
    return { durationS: s };
  }
  if (!t) return field === "weight" ? { weightKg: null } : field === "reps" ? { reps: null } : { distanceM: null };
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) throw new Error(`${field[0].toUpperCase()}${field.slice(1)} must be a number`);
  if (field === "weight") return { weightKg: toKg(n, u.weightUnit) };
  if (field === "reps") return { reps: Math.round(n) };
  return { distanceM: toMetres(n, u.distanceUnit) };
}

const EXTRAS = slot("setRowExtras");

/** Column templates for set rows and their header: number, previous, one or two inputs, tick, remove. */
export const SET_GRID = {
  2: "grid-cols-[2.25rem_minmax(0,1fr)_4.25rem_4.25rem_2rem_1.75rem]",
  1: "grid-cols-[2.25rem_minmax(0,1fr)_8.75rem_2rem_1.75rem]",
} as const;

/** Which inputs a measure shows, in order. */
export const FIELDS: Record<Exercise["measure"], Field[]> = {
  weight: ["weight", "reps"],
  reps: ["weight", "reps"],
  time: ["duration"],
  distance: ["distance", "duration"],
};

export function fieldLabel(field: Field, measure: Exercise["measure"], u: Settings): string {
  switch (field) {
    case "weight":
      return measure === "reps" ? `+${u.weightUnit}` : u.weightUnit;
    case "reps":
      return "Reps";
    case "duration":
      return "Time";
    case "distance":
      return u.distanceUnit;
  }
}

/**
 * One set while logging. Numbers are typed in the user's units and saved when a field loses focus; the tick
 * saves everything and marks the set done. Tapping the set number toggles warm-up.
 */
export function SetRow({
  workout,
  line,
  set,
  index,
  workingIndex,
  exercise,
  previous,
  settings,
  pending,
  onSave,
  onRemove,
}: {
  workout: Workout;
  line: WorkoutExercise;
  set: WorkoutSet;
  /** Position among all sets (for labels). */
  index: number;
  /** 1-based count among working sets, shown in the number column. */
  workingIndex: number;
  exercise: Exercise;
  /** The set in the same position last time, if any. */
  previous?: WorkoutSet;
  settings: Settings;
  pending: boolean;
  onSave: (fields: SetFields) => void;
  onRemove: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(set, settings));
  const focused = useRef<Field | null>(null);
  const fields = FIELDS[exercise.measure];

  // Pick up values saved elsewhere (another field, the server) without clobbering the field being typed in.
  useEffect(() => {
    const fresh = toDraft(set, settings);
    setDraft((d) => {
      const next = { ...fresh };
      if (focused.current) next[focused.current] = d[focused.current];
      return next;
    });
  }, [set, settings]);

  const changed = (field: Field) => draft[field] !== toDraft(set, settings)[field];

  const saveField = (field: Field) => {
    focused.current = null;
    if (!changed(field)) return;
    try {
      onSave(parseField(field, draft[field], settings));
    } catch (err) {
      toast.error((err as Error).message);
      setDraft(toDraft(set, settings));
    }
  };

  const toggleDone = () => {
    if (set.completed) return onSave({ completed: false });
    try {
      const patch: SetFields = { completed: true };
      for (const f of fields) Object.assign(patch, parseField(f, draft[f], settings));
      onSave(patch);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const fillFromPrevious = () => {
    if (!previous || set.completed) return;
    setDraft(toDraft(previous, settings));
    const patch: SetFields = {};
    for (const f of fields) Object.assign(patch, parseField(f, toDraft(previous, settings)[f], settings));
    onSave(patch);
  };

  const warm = set.kind === "warmup";

  return (
    <div
      className={cn(
        "grid items-center gap-2 border-t px-3 py-1.5 transition-colors sm:px-4",
        SET_GRID[fields.length === 2 ? 2 : 1],
        set.completed && "border-transparent bg-volt text-volt-foreground",
      )}
    >
      <button
        type="button"
        onClick={() => onSave({ kind: warm ? "working" : "warmup" })}
        disabled={pending}
        title={warm ? "Warm-up set (tap to make it a working set)" : "Working set (tap to make it a warm-up)"}
        className={cn(
          "num grid h-8 place-items-center rounded-sm text-sm font-semibold",
          warm ? "border border-dashed border-current text-xs" : set.completed ? "bg-black/10" : "bg-secondary",
        )}
      >
        {warm ? "W" : workingIndex}
      </button>
      <button
        type="button"
        onClick={fillFromPrevious}
        disabled={!previous || set.completed || pending}
        title={previous ? "Use last time's numbers" : undefined}
        className={cn(
          "num truncate text-left text-xs enabled:hover:underline",
          set.completed ? "opacity-60" : "text-muted-foreground",
        )}
      >
        {previous ? formatSet(previous, exercise.measure, settings) : "—"}
      </button>
      {fields.map((f) => (
        <Input
          key={f}
          aria-label={`Set ${index + 1} ${fieldLabel(f, exercise.measure, settings)}`}
          inputMode={f === "duration" ? "text" : f === "reps" ? "numeric" : "decimal"}
          placeholder={f === "duration" ? "m:ss" : "–"}
          value={draft[f]}
          disabled={set.completed}
          onFocus={() => {
            focused.current = f;
          }}
          onChange={(e) => setDraft((d) => ({ ...d, [f]: e.target.value }))}
          onBlur={() => saveField(f)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          className={cn(
            "num h-8 rounded-sm px-2 text-center font-semibold",
            set.completed && "border-transparent bg-transparent shadow-none disabled:opacity-100",
          )}
        />
      ))}
      <button
        type="button"
        aria-label={set.completed ? `Untick set ${index + 1}` : `Tick off set ${index + 1}`}
        aria-pressed={set.completed}
        disabled={pending}
        onClick={toggleDone}
        className={cn(
          "grid size-8 place-items-center rounded-sm border transition-colors disabled:opacity-50",
          set.completed
            ? "border-volt-foreground bg-volt-foreground text-volt"
            : "border-input bg-card hover:border-foreground",
        )}
      >
        <Check className="size-4" strokeWidth={3} />
      </button>
      <button
        type="button"
        aria-label={`Remove set ${index + 1}`}
        disabled={pending}
        onClick={onRemove}
        className={cn(
          "grid size-7 place-items-center rounded-sm hover:bg-black/10",
          set.completed ? "opacity-50" : "text-muted-foreground",
        )}
      >
        <X className="size-3.5" />
      </button>
      {EXTRAS.length > 0 && (
        <div className="col-span-full flex flex-wrap items-center gap-2 pl-[2.75rem] text-xs empty:hidden">
          {EXTRAS.map((Extra, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: the extras list is fixed at build time.
            <Extra key={i} workout={workout} line={line} exercise={exercise} set={set} index={index} />
          ))}
        </div>
      )}
    </div>
  );
}
