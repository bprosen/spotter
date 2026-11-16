import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getExercise } from "@/data/exercises";
import type { RoutineFields } from "@/lib/server-fns";
import type { Routine } from "@/lib/types";
import { AddExerciseButton, ExercisePicker } from "./exercise-picker";
import { FormSection } from "./form-section";

type Line = { key: number; exerciseId: string | null; sets: string; reps: string; note: string };

let nextKey = 1;
const line = (exerciseId: string | null = null): Line => ({
  key: nextKey++,
  exerciseId,
  sets: "3",
  reps: "",
  note: "",
});

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const out = [...list];
  const [x] = out.splice(from, 1);
  out.splice(to, 0, x);
  return out;
}

/** The routine editor, shared by "new" and "edit". Validation happens on the server. */
export function RoutineForm({
  initial,
  pending,
  submitLabel,
  onSubmit,
}: {
  initial?: Routine;
  pending: boolean;
  submitLabel: string;
  onSubmit: (fields: RoutineFields) => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [lines, setLines] = useState<Line[]>(
    initial?.exercises.map((e) => ({
      key: nextKey++,
      exerciseId: e.exerciseId,
      sets: String(e.sets),
      reps: e.reps == null ? "" : String(e.reps),
      note: e.note ?? "",
    })) ?? [],
  );
  const setLine = (key: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  return (
    <form
      className="space-y-8"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          title,
          description: description || null,
          exercises: lines
            .filter((l) => l.exerciseId)
            .map((l) => ({
              exerciseId: l.exerciseId!,
              sets: Number(l.sets),
              reps: l.reps.trim() === "" ? null : Number(l.reps),
              note: l.note || null,
            })),
        });
      }}
    >
      <FormSection title="About" description="A name you'll recognise on the start screen.">
        <div className="space-y-1.5">
          <Label htmlFor="r-title">Name</Label>
          <Input
            id="r-title"
            required
            maxLength={120}
            placeholder="Upper body A"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="r-desc">Description</Label>
          <Textarea
            id="r-desc"
            rows={2}
            maxLength={1000}
            placeholder="What it's for, how often you run it…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
      </FormSection>

      <FormSection
        title="Exercises"
        description="In order. Starting the routine lays out this many sets of each, filled in with last time's weights."
      >
        {lines.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">No exercises yet. Add the first below.</p>
        )}
        {lines.map((l, i) => {
          const e = l.exerciseId ? getExercise(l.exerciseId) : undefined;
          // Rep targets only make sense for rep-based exercises.
          const hasReps = !e || e.measure === "weight" || e.measure === "reps";
          return (
            <div key={l.key} className="panel flex flex-wrap items-center gap-2 p-2">
              <span className="num w-5 text-center text-sm text-muted-foreground">{i + 1}</span>
              <ExercisePicker
                value={l.exerciseId}
                onChange={(id) => setLine(l.key, { exerciseId: id })}
                className="min-w-48 flex-1"
              />
              <label className="flex items-center gap-1 text-xs text-muted-foreground">
                Sets
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={20}
                  required={!!l.exerciseId}
                  aria-label={`Exercise ${i + 1} sets`}
                  className="num h-8 w-14 text-center"
                  value={l.sets}
                  onChange={(ev) => setLine(l.key, { sets: ev.target.value })}
                />
              </label>
              {hasReps && (
                <label className="flex items-center gap-1 text-xs text-muted-foreground">
                  Reps
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    placeholder="any"
                    aria-label={`Exercise ${i + 1} reps`}
                    className="num h-8 w-16 text-center"
                    value={l.reps}
                    onChange={(ev) => setLine(l.key, { reps: ev.target.value })}
                  />
                </label>
              )}
              <Input
                aria-label={`Exercise ${i + 1} note`}
                placeholder="note"
                maxLength={200}
                className="h-8 w-40"
                value={l.note}
                onChange={(ev) => setLine(l.key, { note: ev.target.value })}
              />
              <div className="flex">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  aria-label="Move up"
                  onClick={() => setLines((ls) => move(ls, i, i - 1))}
                >
                  <ArrowUp className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  aria-label="Move down"
                  onClick={() => setLines((ls) => move(ls, i, i + 1))}
                >
                  <ArrowDown className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  aria-label="Remove exercise"
                  onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
        <AddExerciseButton onPick={(id) => setLines((ls) => [...ls, line(id)])}>
          <Plus className="size-4" /> Add exercise
        </AddExerciseButton>
      </FormSection>

      <div className="flex justify-end gap-2 border-t pt-5">
        <Button type="submit" disabled={pending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
