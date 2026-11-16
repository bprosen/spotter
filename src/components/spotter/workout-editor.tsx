import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, Info, MoreHorizontal, NotebookPen, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useMutation } from "@/hooks/use-mutation";
import { useTraining } from "@/hooks/use-snapshot";
import { emitSetCompleted, slot } from "@/lib/features";
import {
  addSet,
  addWorkoutExercise,
  editWorkoutExerciseNote,
  moveWorkoutExercise,
  removeSet,
  removeWorkoutExercise,
  type SetFields,
  updateSet,
} from "@/lib/server-fns";
import { countedSets, exerciseOf, previousSets } from "@/lib/training";
import type { Workout, WorkoutExercise } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AddExerciseButton } from "./exercise-picker";
import { MuscleChip } from "./muscle-chip";
import { FIELDS, fieldLabel, SET_GRID, SetRow } from "./set-row";

const EXERCISE_ACTIONS = slot("workoutExerciseActions");
const SECTIONS = slot("workoutSections");

/** Working sets ticked off, as a row of segments. */
function Progress({ done, total }: { done: number; total: number }) {
  if (total === 0) return null;
  return (
    <span className="flex items-center gap-1.5" title={`${done} of ${total} working sets done`}>
      <span className="flex gap-0.5" aria-hidden>
        {Array.from({ length: total }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: segments are positional.
          <span key={i} className={cn("h-1.5 w-3 rounded-[1px]", i < done ? "bg-volt" : "bg-border")} />
        ))}
      </span>
      <span className="num text-[11px] text-muted-foreground">
        {done}/{total}
      </span>
    </span>
  );
}

/** One exercise in a workout: its header, its sets and an "add set" button. */
function ExerciseCard({ workout, line, index }: { workout: Workout; line: WorkoutExercise; index: number }) {
  const { snapshot, settings } = useTraining();
  const { run, pending } = useMutation();
  const exercise = exerciseOf(line);
  const previous = useMemo(
    () => previousSets(snapshot.workouts, line.exerciseId, workout.id),
    [snapshot.workouts, line.exerciseId, workout.id],
  );
  const [editingNote, setEditingNote] = useState(false);
  const [note, setNote] = useState(line.note ?? "");
  const fields = FIELDS[exercise.measure];
  const done = countedSets(line).length;
  const workingTotal = line.sets.filter((s) => s.kind === "working").length;

  const save = (setId: number, fields: SetFields) =>
    run(() => updateSet({ data: { id: setId, ...fields } }), {
      onSuccess: (res) => {
        if (fields.completed && res) emitSetCompleted({ workout: res.workout, line: res.line, exercise, set: res.set });
      },
    });

  let working = 0;

  return (
    <section className="panel overflow-hidden">
      <header className="flex items-start gap-3 px-3 pt-3 pb-3 sm:px-4">
        <span className="font-display w-9 shrink-0 pt-0.5 text-3xl text-muted-foreground/60">
          {String(index + 1).padStart(2, "0")}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Link
              to="/exercises/$id"
              params={{ id: exercise.id }}
              className="truncate text-lg leading-tight font-semibold hover:underline"
            >
              {exercise.name}
            </Link>
            {exercise.cue && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="size-4 shrink-0 text-muted-foreground" aria-label="Form cue" />
                </TooltipTrigger>
                <TooltipContent className="max-w-64">{exercise.cue}</TooltipContent>
              </Tooltip>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <MuscleChip muscle={exercise.muscle} />
            <Progress done={done} total={workingTotal} />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {EXERCISE_ACTIONS.map((Action, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: the action list is fixed at build time.
            <Action key={i} workout={workout} line={line} exercise={exercise} />
          ))}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={`${exercise.name} options`}>
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setEditingNote(true)}>
                <NotebookPen className="size-4" /> {line.note ? "Edit note" : "Add note"}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={index === 0}
                onSelect={() => run(() => moveWorkoutExercise({ data: { lineId: line.id, by: -1 } }))}
              >
                <ArrowUp className="size-4" /> Move up
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={index === workout.exercises.length - 1}
                onSelect={() => run(() => moveWorkoutExercise({ data: { lineId: line.id, by: 1 } }))}
              >
                <ArrowDown className="size-4" /> Move down
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() =>
                  run(() => removeWorkoutExercise({ data: { lineId: line.id } }), {
                    success: `Removed ${exercise.name}`,
                  })
                }
              >
                <Trash2 className="size-4" /> Remove exercise
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <div>
        {editingNote ? (
          <form
            className="flex gap-2 px-3 pb-3 sm:px-4"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => editWorkoutExerciseNote({ data: { lineId: line.id, note: note || null } }), {
                onSuccess: () => setEditingNote(false),
              });
            }}
          >
            <Input
              autoFocus
              value={note}
              maxLength={500}
              placeholder="Seat height 4, felt easy…"
              onChange={(e) => setNote(e.target.value)}
              className="h-8"
            />
            <Button size="sm" type="submit" disabled={pending}>
              Save
            </Button>
          </form>
        ) : (
          line.note && (
            <p className="mx-3 mb-3 border-l-2 border-volt pl-2 text-sm text-muted-foreground sm:mx-4">{line.note}</p>
          )
        )}
        <div
          className={cn("grid gap-2 border-t bg-muted/60 px-3 py-1.5 sm:px-4", SET_GRID[fields.length === 2 ? 2 : 1])}
        >
          <span className="eyebrow text-center text-[10px] text-muted-foreground">Set</span>
          <span className="eyebrow text-[10px] text-muted-foreground">Last time</span>
          {fields.map((f) => (
            <span key={f} className="eyebrow text-center text-[10px] text-muted-foreground">
              {fieldLabel(f, exercise.measure, settings)}
            </span>
          ))}
          <span />
          <span />
        </div>
        {line.sets.map((s, i) => {
          if (s.kind === "working") working++;
          return (
            <SetRow
              key={s.id}
              workout={workout}
              line={line}
              set={s}
              index={i}
              workingIndex={working}
              exercise={exercise}
              previous={previous[i]}
              settings={settings}
              pending={pending}
              onSave={(fields) => save(s.id, fields)}
              onRemove={() => run(() => removeSet({ data: { id: s.id } }))}
            />
          );
        })}
        <button
          type="button"
          className="flex w-full items-center justify-center gap-1.5 border-t py-2.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
          disabled={pending}
          onClick={() => run(() => addSet({ data: { lineId: line.id } }))}
        >
          <Plus className="size-3.5" /> Add set
        </button>
      </div>
    </section>
  );
}

/**
 * The exercises and sets of a workout, editable. Used for the workout in progress and for fixing up finished
 * ones (where newly added sets still need ticking off to count).
 */
export function WorkoutEditor({ workout }: { workout: Workout }) {
  const { finished } = useTraining();
  const { run, pending } = useMutation();
  // The exercises from recent workouts, most recent first, for the top of the picker.
  const recent = useMemo(() => {
    const seen = new Set<string>();
    for (const w of finished.slice(0, 10)) for (const l of w.exercises) seen.add(l.exerciseId);
    return [...seen].slice(0, 8);
  }, [finished]);

  return (
    <div className="space-y-4">
      {workout.exercises.length === 0 && (
        <div className="rounded-lg border border-dashed px-6 py-12 text-center">
          <p className="font-display text-4xl text-muted-foreground/70">Empty bar</p>
          <p className="mt-2 text-sm text-muted-foreground">Add your first exercise to start logging sets.</p>
        </div>
      )}
      {workout.exercises.map((line, i) => (
        <ExerciseCard key={line.id} workout={workout} line={line} index={i} />
      ))}
      <AddExerciseButton
        recent={recent}
        disabled={pending}
        onPick={(exerciseId) => run(() => addWorkoutExercise({ data: { workoutId: workout.id, exerciseId } }))}
      />
      {SECTIONS.map((Section, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: the section list is fixed at build time.
        <Section key={i} workout={workout} />
      ))}
    </div>
  );
}
