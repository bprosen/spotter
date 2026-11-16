import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Play } from "lucide-react";
import { useMemo } from "react";
import { Elapsed } from "@/components/spotter/elapsed";
import { SectionHeading } from "@/components/spotter/page-header";
import { useStartWorkout } from "@/components/spotter/start-workout";
import { Metric, Metrics } from "@/components/spotter/stat";
import { WorkoutList } from "@/components/spotter/workout-row";
import { Button } from "@/components/ui/button";
import { useTraining } from "@/hooks/use-snapshot";
import { dateOf, formatDay, relativeDays } from "@/lib/dates";
import { slot } from "@/lib/features";
import { countedSets, weekSummaries } from "@/lib/training";
import { formatMinutes, formatVolume, plural } from "@/lib/units";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

const WIDGETS = slot("homeWidgets");

function Dashboard() {
  const { snapshot, settings, finished, active, today } = useTraining();
  const { start, pending } = useStartWorkout();
  const [thisWeek] = useMemo(
    () => weekSummaries(snapshot.workouts, { weeks: 1, weekStart: settings.weekStart, on: today }),
    [snapshot.workouts, settings.weekStart, today],
  );
  const goal = settings.weeklyGoal;
  const left = Math.max(0, goal - thisWeek.workouts);
  const empty = snapshot.workouts.length === 0 && snapshot.routines.length === 0;

  return (
    <div className="space-y-10">
      {/* The scoreboard: this week against the goal, and the big button. */}
      <section className="overflow-hidden rounded-xl bg-rail text-rail-foreground">
        <div className="grid gap-6 p-6 sm:p-8 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p className="eyebrow text-rail-muted">
              {formatDay(today)} · Hey, {settings.displayName}
            </p>
            <div className="mt-4 flex items-end gap-3">
              <span className="font-display text-8xl leading-[0.8] sm:text-9xl">{thisWeek.workouts}</span>
              <span className="font-display pb-1 text-4xl text-rail-muted">/ {goal}</span>
            </div>
            <p className="mt-3 text-sm text-rail-muted">
              {thisWeek.workouts === 0
                ? finished.length
                  ? "Workouts this week. The board's empty, let's change that."
                  : "Workouts this week. Log your first one to get the board moving."
                : left > 0
                  ? `Workouts this week. ${left} more to hit your goal.`
                  : "Workouts this week. Goal hit; anything else is a bonus."}
            </p>
            <div className="mt-4 flex gap-1" aria-hidden>
              {Array.from({ length: Math.max(goal, thisWeek.workouts) }, (_, i) => (
                <span
                  // biome-ignore lint/suspicious/noArrayIndexKey: segments are positional.
                  key={i}
                  className={cn("h-2 flex-1 rounded-[2px]", i < thisWeek.workouts ? "bg-volt" : "bg-white/10")}
                />
              ))}
            </div>
          </div>
          {active ? (
            <Link
              to="/workouts/$id"
              params={{ id: String(active.id) }}
              className="block min-w-60 rounded-lg border border-live/50 bg-live/10 p-4 transition-colors hover:bg-live/20"
            >
              <span className="eyebrow text-live">Live now</span>
              <p className="mt-1 truncate font-semibold">{active.title}</p>
              <div className="mt-2 flex items-end justify-between gap-4">
                <Elapsed since={active.startedAt} className="num text-3xl font-semibold" />
                <span className="flex items-center gap-1 text-sm font-medium">
                  Resume <ArrowRight className="size-4" />
                </span>
              </div>
              <p className="num mt-1 text-xs text-rail-muted">
                {plural(
                  active.exercises.reduce((n, l) => n + countedSets(l).length, 0),
                  "set",
                )}{" "}
                done
              </p>
            </Link>
          ) : (
            <Link
              to="/train"
              className="flex min-w-60 items-center justify-between gap-6 rounded-lg bg-volt px-5 py-4 text-volt-foreground transition-transform hover:-translate-y-0.5"
            >
              <span>
                <span className="eyebrow block opacity-70">Ready?</span>
                <span className="font-display text-3xl">Start workout</span>
              </span>
              <Play className="size-6 fill-current" />
            </Link>
          )}
        </div>
      </section>

      {empty && (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            New here? Load six weeks of sample training to look around, then reset it from Settings.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link to="/settings">Go to Settings</Link>
          </Button>
        </div>
      )}

      <Metrics className="grid-cols-2 sm:grid-cols-4">
        <Metric label="Sets this week" value={thisWeek.sets} />
        <Metric
          label="Volume this week"
          value={thisWeek.volumeKg > 0 ? formatVolume(thisWeek.volumeKg, settings.weightUnit) : "—"}
        />
        <Metric label="Time this week" value={thisWeek.durationS ? formatMinutes(thisWeek.durationS) : "—"} />
        <Metric label="All-time workouts" value={finished.length} />
      </Metrics>

      <div className="grid gap-10 lg:grid-cols-[3fr_2fr]">
        <section>
          <SectionHeading
            count={finished.length || undefined}
            action={
              finished.length > 0 && (
                <Link to="/workouts" className="text-sm font-medium hover:underline">
                  All history
                </Link>
              )
            }
          >
            Recent
          </SectionHeading>
          {finished.length === 0 ? (
            <p className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
              Finished workouts show up here.
            </p>
          ) : (
            <WorkoutList workouts={finished.slice(0, 5)} settings={settings} today={today} />
          )}
        </section>

        <section>
          <SectionHeading
            action={
              <Link to="/routines" className="text-sm font-medium hover:underline">
                Manage
              </Link>
            }
          >
            Routines
          </SectionHeading>
          {snapshot.routines.length === 0 ? (
            <p className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
              No routines yet.{" "}
              <Link to="/routines/new" className="font-medium text-foreground underline">
                Build one
              </Link>
            </p>
          ) : (
            <ul className="panel divide-y overflow-hidden">
              {snapshot.routines.map((r) => {
                const last = finished.find((w) => w.routineId === r.id);
                return (
                  <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <Link to="/routines/$id" params={{ id: String(r.id) }} className="min-w-0 hover:underline">
                      <p className="truncate font-semibold">{r.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {plural(r.exercises.length, "exercise")}
                        {last && ` · ${relativeDays(dateOf(last.startedAt), today)}`}
                      </p>
                    </Link>
                    <Button size="sm" variant="outline" disabled={pending || !!active} onClick={() => start(r)}>
                      <Play className="size-3 fill-current" /> Start
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {WIDGETS.length > 0 && (
        <section className="grid gap-6 md:grid-cols-2">
          {WIDGETS.map((Widget, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: the widget list is fixed at build time.
            <Widget key={i} />
          ))}
        </section>
      )}
    </div>
  );
}
