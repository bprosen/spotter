import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Pencil, Play, Trash2 } from "lucide-react";
import { MuscleChip } from "@/components/spotter/muscle-chip";
import { NotFound } from "@/components/spotter/not-found";
import { PageHeader, SectionHeading } from "@/components/spotter/page-header";
import { useStartWorkout } from "@/components/spotter/start-workout";
import { WorkoutList } from "@/components/spotter/workout-row";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { getExercise } from "@/data/exercises";
import { useMutation } from "@/hooks/use-mutation";
import { useTraining } from "@/hooks/use-snapshot";
import { slot } from "@/lib/features";
import { deleteRoutine } from "@/lib/server-fns";
import { bestSet, exerciseHistory, formatSet } from "@/lib/training";
import { plural } from "@/lib/units";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/routines/$id/")({
  head: () => ({ meta: [{ title: "Routine · Spotter" }] }),
  component: RoutinePage,
});

const SECTIONS = slot("routineSections");

/** Columns shared by the exercise table's header and rows: number, exercise (shrinks), target. */
const ROW = "grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 px-4";

function RoutinePage() {
  const { id } = Route.useParams();
  const { snapshot, routineById, finished, active, settings, today } = useTraining();
  const navigate = useNavigate();
  const { run, pending } = useMutation();
  const { start, pending: starting } = useStartWorkout();
  const routine = routineById.get(Number(id));
  if (!routine) return <NotFound what="routine" />;
  const runs = finished.filter((w) => w.routineId === routine.id);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        title={routine.title}
        meta={routine.description ?? `${plural(routine.exercises.length, "exercise")}.`}
      >
        <Button disabled={starting || !!active} onClick={() => start(routine)}>
          <Play className="size-3.5 fill-current" /> Start
        </Button>
        <Button asChild variant="outline">
          <Link to="/routines/$id/edit" params={{ id }}>
            <Pencil className="size-4" /> Edit
          </Link>
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" disabled={pending} aria-label="Delete routine">
              <Trash2 className="size-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {routine.title}?</AlertDialogTitle>
              <AlertDialogDescription>
                Workouts you've done from it stay in your history; they just won't be linked to it any more.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() =>
                  run(() => deleteRoutine({ data: { id: routine.id } }), {
                    success: "Routine deleted",
                    onSuccess: () => navigate({ to: "/routines" }),
                  })
                }
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </PageHeader>
      {active && <p className="text-sm text-muted-foreground">Finish the workout in progress to start this routine.</p>}

      <section>
        <SectionHeading count={routine.exercises.length}>Exercises</SectionHeading>
        <div className="panel overflow-hidden">
          <div className={cn(ROW, "border-b bg-muted/60 py-1.5")}>
            <span className="eyebrow text-[10px] text-muted-foreground">#</span>
            <span className="eyebrow text-[10px] text-muted-foreground">Exercise</span>
            <span className="eyebrow text-right text-[10px] text-muted-foreground">Target · last time</span>
          </div>
          <ol className="divide-y">
            {routine.exercises.map((re, i) => {
              const e = getExercise(re.exerciseId);
              const last = e && exerciseHistory(snapshot.workouts, e.id)[0];
              const best = e && last && bestSet(last.sets, e.measure);
              return (
                // biome-ignore lint/suspicious/noArrayIndexKey: an exercise can appear twice in a routine.
                <li key={i} className={cn(ROW, "py-3")}>
                  <span className="font-display text-2xl text-muted-foreground/60">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0">
                    {e ? (
                      <Link
                        to="/exercises/$id"
                        params={{ id: e.id }}
                        className="block truncate font-semibold hover:underline"
                      >
                        {e.name}
                      </Link>
                    ) : (
                      <span className="block truncate font-semibold">{re.exerciseId}</span>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {e && <MuscleChip muscle={e.muscle} />}
                      {re.note && <span className="break-words">{re.note}</span>}
                    </div>
                  </div>
                  <div className="text-right whitespace-nowrap">
                    <p className="num font-semibold">
                      {re.sets}
                      {re.reps ? ` × ${re.reps}` : ` ${re.sets === 1 ? "set" : "sets"}`}
                    </p>
                    {best && e && (
                      <p className="num text-xs text-muted-foreground">last {formatSet(best, e.measure, settings)}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {SECTIONS.map((Section, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: the section list is fixed at build time.
        <Section key={i} routine={routine} />
      ))}

      <section>
        <SectionHeading count={runs.length || undefined}>Past sessions</SectionHeading>
        {runs.length === 0 ? (
          <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
            Not done yet.
          </p>
        ) : (
          <WorkoutList workouts={runs.slice(0, 8)} settings={settings} today={today} />
        )}
      </section>
    </div>
  );
}
