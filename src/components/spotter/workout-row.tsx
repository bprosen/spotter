import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { dateOf, formatTime, relativeDays } from "@/lib/dates";
import { countedSets, exerciseOf, musclesWorked, workoutStats } from "@/lib/training";
import type { Settings, Workout } from "@/lib/types";
import { formatMinutes, formatVolume } from "@/lib/units";
import { cn } from "@/lib/utils";
import { regionColor } from "./muscle-chip";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** A tear-off calendar date: weekday over a big day number over the month. */
export function DateBlock({ date, className }: { date: string; className?: string }) {
  const [y, m, d] = date.split("-").map(Number);
  const day = new Date(y, m - 1, d).getDay();
  return (
    <div className={cn("flex w-12 shrink-0 flex-col items-center text-center", className)}>
      <span className="eyebrow text-[10px] text-muted-foreground">{DAYS[day]}</span>
      <span className="font-display text-3xl leading-none">{d}</span>
      <span className="eyebrow text-[10px] text-muted-foreground">{MONTHS[m - 1]}</span>
    </div>
  );
}

/**
 * A finished workout as one line of a log: the date, the title, what was done, and the totals in columns.
 * Meant to be stacked inside a `divide-y` panel.
 */
export function WorkoutRow({ workout, settings, today }: { workout: Workout; settings: Settings; today: string }) {
  const stats = workoutStats(workout);
  const date = dateOf(workout.startedAt);
  const names = workout.exercises.filter((l) => countedSets(l).length > 0).map((l) => exerciseOf(l).name);
  const muscles = musclesWorked(workout).slice(0, 5);
  return (
    <Link
      to="/workouts/$id"
      params={{ id: String(workout.id) }}
      className="group flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-secondary/60"
    >
      <DateBlock date={date} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-semibold">{workout.title}</p>
          <span className="flex gap-0.5" aria-hidden>
            {muscles.map((m) => (
              <span key={m} className={cn("h-3 w-1 rounded-[1px]", regionColor(m))} />
            ))}
          </span>
        </div>
        <p className="truncate text-sm text-muted-foreground">{names.join(" · ") || "No sets logged"}</p>
        <p className="mt-0.5 text-xs text-muted-foreground sm:hidden">
          {formatTime(workout.startedAt)} · {relativeDays(date, today)}
        </p>
      </div>
      <dl className="hidden shrink-0 grid-cols-3 gap-6 text-right sm:grid">
        <div>
          <dt className="eyebrow text-[10px] text-muted-foreground">Time</dt>
          <dd className="num text-sm">{stats.durationS != null ? formatMinutes(stats.durationS) : "—"}</dd>
        </div>
        <div>
          <dt className="eyebrow text-[10px] text-muted-foreground">Sets</dt>
          <dd className="num text-sm">{stats.sets}</dd>
        </div>
        <div className="w-20">
          <dt className="eyebrow text-[10px] text-muted-foreground">Volume</dt>
          <dd className="num text-sm">
            {stats.volumeKg > 0 ? formatVolume(stats.volumeKg, settings.weightUnit) : "—"}
          </dd>
        </div>
      </dl>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

/** A stack of `WorkoutRow`s in one panel. */
export function WorkoutList({ workouts, settings, today }: { workouts: Workout[]; settings: Settings; today: string }) {
  return (
    <div className="panel divide-y overflow-hidden">
      {workouts.map((w) => (
        <WorkoutRow key={w.id} workout={w} settings={settings} today={today} />
      ))}
    </div>
  );
}
