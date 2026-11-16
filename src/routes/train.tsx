import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CalendarPlus, Play, Plus } from "lucide-react";
import { Elapsed } from "@/components/spotter/elapsed";
import { MuscleChip } from "@/components/spotter/muscle-chip";
import { PageHeader, SectionHeading } from "@/components/spotter/page-header";
import { LogPastDialog, useStartWorkout } from "@/components/spotter/start-workout";
import { Button } from "@/components/ui/button";
import { getExercise, type Muscle } from "@/data/exercises";
import { useTraining } from "@/hooks/use-snapshot";
import { dateOf, relativeDays } from "@/lib/dates";
import { countedSets } from "@/lib/training";
import type { Routine } from "@/lib/types";
import { plural } from "@/lib/units";

export const Route = createFileRoute("/train")({
  head: () => ({ meta: [{ title: "Train · Spotter" }] }),
  component: TrainPage,
});

function TrainPage() {
  const { snapshot, active } = useTraining();
  const { start, pending } = useStartWorkout();

  return (
    <div className="space-y-10">
      <PageHeader title="Train" meta="Start from nothing and add exercises as you go, or run one of your routines." />

      {active ? (
        <Link
          to="/workouts/$id"
          params={{ id: String(active.id) }}
          className="flex flex-col gap-4 rounded-xl border border-live/40 bg-live/10 p-6 transition-colors hover:bg-live/15 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="eyebrow text-live">In progress</p>
            <p className="font-display mt-1 text-4xl">{active.title}</p>
            <p className="num mt-1 text-sm text-muted-foreground">
              <Elapsed since={active.startedAt} /> ·{" "}
              {plural(
                active.exercises.reduce((n, l) => n + countedSets(l).length, 0),
                "set",
              )}{" "}
              done
            </p>
          </div>
          <span className="flex items-center gap-2 font-semibold">
            Resume <ArrowRight className="size-4" />
          </span>
        </Link>
      ) : (
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
          <button
            type="button"
            disabled={pending}
            onClick={() => start()}
            className="group flex min-h-40 flex-col justify-between rounded-xl bg-volt p-6 text-left text-volt-foreground transition-transform hover:-translate-y-0.5 disabled:opacity-60"
          >
            <Play className="size-7 fill-current" />
            <span>
              <span className="font-display block text-5xl">Empty workout</span>
              <span className="text-sm opacity-70">Pick exercises as you go.</span>
            </span>
          </button>
          <LogPastDialog
            trigger={
              <button
                type="button"
                className="flex min-h-40 flex-col justify-between rounded-xl border-2 border-dashed p-6 text-left transition-colors hover:border-foreground"
              >
                <CalendarPlus className="size-7" />
                <span>
                  <span className="font-display block text-3xl">Log past workout</span>
                  <span className="text-sm text-muted-foreground">Forgot to track one? Add it after the fact.</span>
                </span>
              </button>
            }
          />
        </div>
      )}

      <section>
        <SectionHeading
          count={snapshot.routines.length || undefined}
          action={
            <Button asChild variant="ghost" size="sm">
              <Link to="/routines/new">
                <Plus className="size-4" /> New routine
              </Link>
            </Button>
          }
        >
          Routines
        </SectionHeading>
        {snapshot.routines.length === 0 ? (
          <p className="rounded-lg border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
            Routines are workouts you repeat. Build one and starting it lays out every exercise and set for you.
          </p>
        ) : (
          <ul className="panel divide-y overflow-hidden">
            {snapshot.routines.map((r) => (
              <RoutineLine key={r.id} routine={r} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function RoutineLine({ routine }: { routine: Routine }) {
  const { finished, active, today } = useTraining();
  const { start, pending } = useStartWorkout();
  const last = finished.find((w) => w.routineId === routine.id);
  const muscles = [...new Set(routine.exercises.map((e) => getExercise(e.exerciseId)?.muscle))].filter(
    (m): m is Muscle => !!m,
  );
  return (
    <li className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <Link to="/routines/$id" params={{ id: String(routine.id) }} className="text-lg font-semibold hover:underline">
          {routine.title}
        </Link>
        <p className="truncate text-sm text-muted-foreground">
          {routine.exercises.map((e) => getExercise(e.exerciseId)?.name ?? e.exerciseId).join(" · ")}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {muscles.slice(0, 4).map((m) => (
            <MuscleChip key={m} muscle={m} />
          ))}
          <span className="num ml-1 text-xs text-muted-foreground">
            {plural(
              routine.exercises.reduce((n, e) => n + e.sets, 0),
              "set",
            )}
            {last ? ` · last ${relativeDays(dateOf(last.startedAt), today)}` : " · never done"}
          </span>
        </div>
      </div>
      <Button disabled={pending || !!active} onClick={() => start(routine)} className="shrink-0">
        <Play className="size-3.5 fill-current" /> Start
      </Button>
    </li>
  );
}
