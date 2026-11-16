import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronRight, Search } from "lucide-react";
import { useMemo } from "react";
import { matchesExercise } from "@/components/spotter/exercise-picker";
import { regionColor } from "@/components/spotter/muscle-chip";
import { PageHeader } from "@/components/spotter/page-header";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  EQUIPMENT,
  EQUIPMENT_IDS,
  type Equipment,
  EXERCISES,
  MEASURES,
  MUSCLE_IDS,
  MUSCLES,
  type Muscle,
} from "@/data/exercises";
import { useTraining } from "@/hooks/use-snapshot";
import { dateOf, relativeDays } from "@/lib/dates";
import { countedSets } from "@/lib/training";
import { plural } from "@/lib/units";
import { cn } from "@/lib/utils";

type CatalogSearch = { q?: string; muscle?: Muscle; equipment?: Equipment; mine?: boolean };

export const Route = createFileRoute("/exercises/")({
  head: () => ({ meta: [{ title: "Exercises · Spotter" }] }),
  validateSearch: (s: Record<string, unknown>): CatalogSearch => ({
    q: typeof s.q === "string" && s.q ? s.q : undefined,
    muscle: MUSCLE_IDS.includes(s.muscle as Muscle) ? (s.muscle as Muscle) : undefined,
    equipment: EQUIPMENT_IDS.includes(s.equipment as Equipment) ? (s.equipment as Equipment) : undefined,
    mine: s.mine === true || s.mine === "true" ? true : undefined,
  }),
  component: CatalogPage,
});

function CatalogPage() {
  const { finished, today } = useTraining();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const set = (patch: Partial<CatalogSearch>) => navigate({ search: (s) => ({ ...s, ...patch }), replace: true });

  // How often, and when last, each exercise was done.
  const usage = useMemo(() => {
    const out = new Map<string, { sessions: number; last: string }>();
    for (const w of finished) {
      for (const id of new Set(w.exercises.filter((l) => countedSets(l).length).map((l) => l.exerciseId))) {
        const u = out.get(id);
        if (u) u.sessions++;
        else out.set(id, { sessions: 1, last: dateOf(w.startedAt) });
      }
    }
    return out;
  }, [finished]);

  const shown = EXERCISES.filter(
    (e) =>
      (!search.muscle || e.muscle === search.muscle || e.secondary.includes(search.muscle)) &&
      (!search.equipment || e.equipment === search.equipment) &&
      (!search.mine || usage.has(e.id)) &&
      matchesExercise(e, search.q ?? ""),
  ).sort((a, b) => {
    // Main-muscle matches before exercises that only work it secondarily.
    if (search.muscle) {
      const d = Number(b.muscle === search.muscle) - Number(a.muscle === search.muscle);
      if (d) return d;
    }
    return 0;
  });

  const muscleCount = (m: Muscle) => EXERCISES.filter((e) => e.muscle === m).length;
  const filterButton = (on: boolean) =>
    cn(
      "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm whitespace-nowrap transition-colors",
      on ? "bg-primary text-primary-foreground" : "hover:bg-secondary",
    );

  return (
    <div>
      <PageHeader
        title="Exercises"
        meta={`${EXERCISES.length} built in.${usage.size ? ` You've done ${usage.size}.` : ""}`}
      />

      <div className="grid gap-6 lg:grid-cols-[12rem_1fr]">
        {/* Muscle filter: a column on desktop, a scrolling strip on mobile. */}
        <nav aria-label="Filter by muscle" className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:overflow-visible lg:px-0">
          <p className="eyebrow mb-2 hidden text-muted-foreground lg:block">Muscle</p>
          <div className="flex gap-1 lg:flex-col">
            <button type="button" onClick={() => set({ muscle: undefined })} className={filterButton(!search.muscle)}>
              <span className="flex-1">All</span>
              <span className="num text-xs opacity-60">{EXERCISES.length}</span>
            </button>
            {MUSCLE_IDS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => set({ muscle: search.muscle === m ? undefined : m })}
                className={filterButton(search.muscle === m)}
              >
                <span className={cn("size-2 rounded-[2px]", regionColor(m))} aria-hidden />
                <span className="flex-1">{MUSCLES[m].label}</span>
                <span className="num text-xs opacity-60">{muscleCount(m)}</span>
              </button>
            ))}
          </div>
        </nav>

        <div className="min-w-0">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search.q ?? ""}
                onChange={(e) => set({ q: e.target.value || undefined })}
                placeholder="Search exercises…"
                className="h-9 pl-8"
                aria-label="Search exercises"
              />
            </div>
            <Select
              value={search.equipment ?? "all"}
              onValueChange={(v) => set({ equipment: v === "all" ? undefined : (v as Equipment) })}
            >
              <SelectTrigger className="h-9 sm:w-44" aria-label="Equipment">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All equipment</SelectItem>
                {EQUIPMENT_IDS.map((e) => (
                  <SelectItem key={e} value={e}>
                    {EQUIPMENT[e].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              type="button"
              aria-pressed={!!search.mine}
              onClick={() => set({ mine: search.mine ? undefined : true })}
              className={cn(
                "h-9 rounded-md border px-3 text-sm font-medium whitespace-nowrap transition-colors",
                search.mine ? "border-volt bg-volt text-volt-foreground" : "bg-card hover:bg-secondary",
              )}
            >
              Done before
            </button>
          </div>

          {shown.length === 0 ? (
            <p className="rounded-lg border border-dashed py-16 text-center text-sm text-muted-foreground">
              No exercises match.
            </p>
          ) : (
            <ul className="panel divide-y overflow-hidden">
              {shown.map((e) => {
                const u = usage.get(e.id);
                return (
                  <li key={e.id}>
                    <Link
                      to="/exercises/$id"
                      params={{ id: e.id }}
                      className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-secondary/60"
                    >
                      <span className={cn("h-8 w-1 shrink-0 rounded-[1px]", regionColor(e.muscle))} aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{e.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {MUSCLES[e.muscle].label} · {EQUIPMENT[e.equipment].label} · {MEASURES[e.measure].label}
                        </p>
                      </div>
                      <span className="num hidden shrink-0 text-right text-xs text-muted-foreground sm:block">
                        {u ? (
                          <>
                            {plural(u.sessions, "session")}
                            <br />
                            {relativeDays(u.last, today)}
                          </>
                        ) : (
                          "—"
                        )}
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
