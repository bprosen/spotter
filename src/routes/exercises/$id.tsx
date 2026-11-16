import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { MuscleChip } from "@/components/spotter/muscle-chip";
import { NotFound } from "@/components/spotter/not-found";
import { PageHeader, SectionHeading } from "@/components/spotter/page-header";
import { DateBlock } from "@/components/spotter/workout-row";
import { Button } from "@/components/ui/button";
import { EQUIPMENT, getExercise, MEASURES, MUSCLES } from "@/data/exercises";
import { useTraining } from "@/hooks/use-snapshot";
import { relativeDays } from "@/lib/dates";
import { slot } from "@/lib/features";
import { exerciseHistory, formatSet } from "@/lib/training";

export const Route = createFileRoute("/exercises/$id")({
  head: () => ({ meta: [{ title: "Exercise · Spotter" }] }),
  component: ExercisePage,
});

const SECTIONS = slot("exerciseSections");

function ExercisePage() {
  const { id } = Route.useParams();
  const { snapshot, settings, today } = useTraining();
  const exercise = getExercise(id);
  const history = useMemo(() => exerciseHistory(snapshot.workouts, id), [snapshot.workouts, id]);
  if (!exercise) return <NotFound what="exercise" />;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <PageHeader
        title={exercise.name}
        meta={`${MUSCLES[exercise.muscle].label} · ${EQUIPMENT[exercise.equipment].label}`}
      >
        {history.length > 0 && (
          <Button asChild variant="outline">
            <Link to="/workouts" search={{ exercise: exercise.id }}>
              All {history.length} sessions
            </Link>
          </Button>
        )}
      </PageHeader>

      <div className="grid gap-6 md:grid-cols-[1fr_16rem]">
        <blockquote className="border-l-4 border-volt py-1 pl-4">
          <p className="eyebrow text-muted-foreground">Cue</p>
          <p className="mt-1 text-lg">{exercise.cue}</p>
        </blockquote>
        <dl className="panel divide-y text-sm">
          <div className="flex items-start justify-between gap-3 px-4 py-2.5">
            <dt className="text-muted-foreground">Works</dt>
            <dd className="flex flex-wrap justify-end gap-1">
              <MuscleChip muscle={exercise.muscle} link />
              {exercise.secondary.map((m) => (
                <MuscleChip key={m} muscle={m} link />
              ))}
            </dd>
          </div>
          <div className="flex justify-between gap-3 px-4 py-2.5">
            <dt className="text-muted-foreground">Equipment</dt>
            <dd className="font-medium">{EQUIPMENT[exercise.equipment].label}</dd>
          </div>
          <div className="flex justify-between gap-3 px-4 py-2.5">
            <dt className="text-muted-foreground">Logged as</dt>
            <dd className="font-medium">{MEASURES[exercise.measure].label}</dd>
          </div>
        </dl>
      </div>

      {SECTIONS.map((Section, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: the section list is fixed at build time.
        <Section key={i} exercise={exercise} />
      ))}

      <section>
        <SectionHeading count={history.length || undefined}>Recent sessions</SectionHeading>
        {history.length === 0 ? (
          <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
            You haven't done {exercise.name.toLowerCase()} yet.
          </p>
        ) : (
          <ul className="panel divide-y overflow-hidden">
            {history.slice(0, 10).map((s) => (
              <li key={s.workoutId}>
                <Link
                  to="/workouts/$id"
                  params={{ id: String(s.workoutId) }}
                  className="flex items-start gap-4 px-4 py-3 transition-colors hover:bg-secondary/60"
                >
                  <DateBlock date={s.date} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-muted-foreground">
                      {s.workoutTitle} · {relativeDays(s.date, today)}
                    </p>
                    <ol className="mt-1.5 flex flex-wrap gap-1.5">
                      {s.sets.map((set) => (
                        <li key={set.id} className="num rounded-sm bg-secondary px-2 py-0.5 text-sm">
                          {formatSet(set, exercise.measure, settings)}
                        </li>
                      ))}
                    </ol>
                    {s.note && <p className="mt-1.5 text-xs text-muted-foreground">{s.note}</p>}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
