import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { BookmarkPlus, Check, Trash2 } from "lucide-react";
import { LiveDot } from "@/components/spotter/app-shell";
import { Elapsed } from "@/components/spotter/elapsed";
import { NotFound } from "@/components/spotter/not-found";
import { PageHeader } from "@/components/spotter/page-header";
import { Metric, Metrics } from "@/components/spotter/stat";
import { WorkoutDetailsDialog } from "@/components/spotter/workout-details-dialog";
import { WorkoutEditor } from "@/components/spotter/workout-editor";
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
import { useMutation } from "@/hooks/use-mutation";
import { useTraining } from "@/hooks/use-snapshot";
import { dateOf, formatDate, formatTime } from "@/lib/dates";
import { deleteWorkout, finishWorkout, routineFromWorkout } from "@/lib/server-fns";
import { workoutStats } from "@/lib/training";
import type { Workout } from "@/lib/types";
import { formatMinutes, formatVolume, plural } from "@/lib/units";

export const Route = createFileRoute("/workouts/$id")({
  head: () => ({ meta: [{ title: "Workout · Spotter" }] }),
  component: WorkoutPage,
});

function WorkoutPage() {
  const { id } = Route.useParams();
  const { workoutById } = useTraining();
  const workout = workoutById.get(Number(id));
  if (!workout) return <NotFound what="workout" />;
  return workout.finishedAt ? <FinishedWorkout workout={workout} /> : <LiveWorkout workout={workout} />;
}

/** Sets ticked off, warm-ups included: finishing needs at least one. */
function completedSets(w: Workout): number {
  return w.exercises.reduce((n, l) => n + l.sets.filter((s) => s.completed).length, 0);
}

function LiveWorkout({ workout }: { workout: Workout }) {
  const navigate = useNavigate();
  const { settings } = useTraining();
  const { run, pending } = useMutation();
  const stats = workoutStats(workout);
  const unticked = workout.exercises.reduce((n, l) => n + l.sets.filter((s) => !s.completed).length, 0);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow flex items-center gap-2 text-live">
            <LiveDot /> Live
          </p>
          <h1 className="font-display mt-2 truncate text-5xl sm:text-6xl">{workout.title}</h1>
        </div>
        <WorkoutDetailsDialog workout={workout} />
      </div>

      {/* The scoreboard stays in view while you scroll through exercises. */}
      <div className="sticky top-14 z-20 -mx-4 mb-6 bg-rail px-4 py-3 text-rail-foreground sm:mx-0 sm:rounded-xl sm:px-5 lg:top-4">
        <div className="flex items-center gap-5 sm:gap-8">
          <div>
            <p className="eyebrow text-[10px] text-rail-muted">Time</p>
            <Elapsed since={workout.startedAt} className="num text-2xl font-semibold sm:text-3xl" />
          </div>
          <div>
            <p className="eyebrow text-[10px] text-rail-muted">Sets</p>
            <p className="num text-2xl font-semibold sm:text-3xl">{stats.sets}</p>
          </div>
          <div className="hidden sm:block">
            <p className="eyebrow text-[10px] text-rail-muted">Volume</p>
            <p className="num text-2xl font-semibold sm:text-3xl">
              {stats.volumeKg > 0 ? formatVolume(stats.volumeKg, settings.weightUnit) : "—"}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={pending}
                  aria-label="Discard workout"
                  className="text-rail-muted hover:bg-white/[0.06] hover:text-rail-foreground"
                >
                  <Trash2 className="size-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Discard this workout?</AlertDialogTitle>
                  <AlertDialogDescription>Everything logged in it so far will be deleted.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep going</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() =>
                      run(() => deleteWorkout({ data: { id: workout.id } }), {
                        success: "Workout discarded",
                        onSuccess: () => navigate({ to: "/train" }),
                      })
                    }
                  >
                    Discard
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  type="button"
                  disabled={pending || completedSets(workout) === 0}
                  className="flex h-10 items-center gap-2 rounded-md bg-volt px-4 font-semibold text-volt-foreground transition-opacity disabled:opacity-40"
                >
                  <Check className="size-4" strokeWidth={3} /> Finish
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Finish workout?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {plural(stats.sets, "working set")} across {plural(stats.exercises, "exercise")}.
                    {unticked > 0 && ` ${plural(unticked, "unticked set")} will be dropped.`}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Not yet</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() =>
                      run(() => finishWorkout({ data: { id: workout.id } }), { success: "Workout saved. Nice work." })
                    }
                  >
                    Finish
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>

      <WorkoutEditor workout={workout} />
    </div>
  );
}

function FinishedWorkout({ workout }: { workout: Workout }) {
  const navigate = useNavigate();
  const { settings, routineById } = useTraining();
  const { run, pending } = useMutation();
  const stats = workoutStats(workout);
  const routine = workout.routineId ? routineById.get(workout.routineId) : undefined;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={workout.title}
        meta={
          <>
            {formatDate(dateOf(workout.startedAt))} · {formatTime(workout.startedAt)}–{formatTime(workout.finishedAt!)}
            {routine && (
              <>
                {" · "}
                <Link to="/routines/$id" params={{ id: String(routine.id) }} className="underline">
                  {routine.title}
                </Link>
              </>
            )}
          </>
        }
      >
        <WorkoutDetailsDialog workout={workout} />
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() =>
            run(() => routineFromWorkout({ data: { workoutId: workout.id } }), {
              success: "Saved as a routine",
              onSuccess: (r) => r && navigate({ to: "/routines/$id", params: { id: String(r.id) } }),
            })
          }
        >
          <BookmarkPlus className="size-4" /> Save as routine
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" disabled={pending} aria-label="Delete workout">
              <Trash2 className="size-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this workout?</AlertDialogTitle>
              <AlertDialogDescription>
                Its sets disappear from your history. This can't be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() =>
                  run(() => deleteWorkout({ data: { id: workout.id } }), {
                    success: "Workout deleted",
                    onSuccess: () => navigate({ to: "/workouts" }),
                  })
                }
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </PageHeader>

      <Metrics className="grid-cols-2 sm:grid-cols-4">
        <Metric label="Duration" value={formatMinutes(stats.durationS ?? 0)} />
        <Metric label="Working sets" value={stats.sets} />
        <Metric label="Volume" value={stats.volumeKg > 0 ? formatVolume(stats.volumeKg, settings.weightUnit) : "—"} />
        <Metric label="Exercises" value={stats.exercises} />
      </Metrics>

      {workout.note && (
        <blockquote className="border-l-4 border-volt py-1 pl-4 text-sm whitespace-pre-line">{workout.note}</blockquote>
      )}

      <WorkoutEditor workout={workout} />
    </div>
  );
}
