import { Check, ChevronsUpDown, Plus, Search } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EQUIPMENT, EXERCISES, type Exercise, getExercise, MUSCLES, type Muscle } from "@/data/exercises";
import { matches } from "@/lib/search";
import { cn } from "@/lib/utils";

export function matchesExercise(e: Exercise, query: string): boolean {
  return (
    matches(e.name, query) ||
    matches(e.id.replace(/-/g, " "), query) ||
    matches(MUSCLES[e.muscle].label, query) ||
    matches(EQUIPMENT[e.equipment].label, query)
  );
}

/** Exercises matching a query, grouped by main muscle in catalog order. */
export function groupExercises(query: string): [Muscle, Exercise[]][] {
  const out = new Map<Muscle, Exercise[]>();
  for (const e of EXERCISES) {
    if (!matchesExercise(e, query)) continue;
    const list = out.get(e.muscle) ?? [];
    list.push(e);
    out.set(e.muscle, list);
  }
  return [...out.entries()];
}

function ExerciseList({
  value,
  onPick,
  recent = [],
}: {
  value?: string | null;
  onPick: (id: string) => void;
  /** Ids shown first under "Recent" while the search box is empty. */
  recent?: string[];
}) {
  const [q, setQ] = useState("");
  const groups = useMemo(() => groupExercises(q), [q]);
  const recentList = q ? [] : recent.map(getExercise).filter((e): e is Exercise => !!e);
  const row = (e: Exercise, key: string) => (
    <button
      key={key}
      type="button"
      onClick={() => {
        onPick(e.id);
        setQ("");
      }}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent",
        e.id === value && "bg-accent/60",
      )}
    >
      <span className="flex-1 truncate">{e.name}</span>
      <span className="text-xs text-muted-foreground">{EQUIPMENT[e.equipment].label}</span>
      {e.id === value && <Check className="size-4 text-primary" />}
    </button>
  );
  return (
    <>
      <div className="relative border-b p-2">
        <Search className="absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search exercises, muscles, equipment…"
          className="h-8 pl-8"
        />
      </div>
      <div className="max-h-80 overflow-y-auto p-1">
        {recentList.length > 0 && (
          <div>
            <p className="eyebrow px-2 pt-2 pb-1 text-muted-foreground">Recent</p>
            {recentList.map((e) => row(e, `recent-${e.id}`))}
          </div>
        )}
        {groups.length === 0 && <p className="p-3 text-center text-sm text-muted-foreground">No matches</p>}
        {groups.map(([muscle, list]) => (
          <div key={muscle}>
            <p className="eyebrow px-2 pt-2 pb-1 text-muted-foreground">{MUSCLES[muscle].label}</p>
            {list.map((e) => row(e, e.id))}
          </div>
        ))}
      </div>
    </>
  );
}

/** Searchable combobox over the whole catalog, grouped by muscle. For forms. */
export function ExercisePicker({
  value,
  onChange,
  placeholder = "Choose an exercise",
  className,
}: {
  value: string | null;
  onChange: (exerciseId: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = value ? getExercise(value) : undefined;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className={cn("justify-between font-normal", className)}>
          <span className="truncate">
            {selected ? selected.name : <span className="text-muted-foreground">{placeholder}</span>}
          </span>
          <ChevronsUpDown className="size-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <ExerciseList
          value={value}
          onPick={(id) => {
            onChange(id);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

/** A button that opens the catalog and calls `onPick`. For "Add exercise" while logging. */
export function AddExerciseButton({
  onPick,
  recent,
  disabled,
  children = (
    <>
      <Plus className="size-4" /> Add exercise
    </>
  ),
}: {
  onPick: (exerciseId: string) => void;
  recent?: string[];
  disabled?: boolean;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" disabled={disabled} className="w-full border-dashed">
          {children}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="center">
        <ExerciseList
          recent={recent}
          onPick={(id) => {
            onPick(id);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
