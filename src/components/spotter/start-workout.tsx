import { useNavigate } from "@tanstack/react-router";
import { CalendarPlus } from "lucide-react";
import { type ReactElement, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation } from "@/hooks/use-mutation";
import { useTraining } from "@/hooks/use-snapshot";
import { addDays, today } from "@/lib/dates";
import { logPastWorkout, startWorkout } from "@/lib/server-fns";
import type { Routine, Workout } from "@/lib/types";

/** Start a workout (empty, or from a routine) and jump to the logger. */
export function useStartWorkout() {
  const navigate = useNavigate();
  const { run, pending } = useMutation();
  const start = (routine?: Routine) =>
    run(() => startWorkout({ data: { routineId: routine?.id ?? null } }), {
      success: routine ? `${routine.title} started` : "Workout started",
      onSuccess: (w: Workout | undefined) => w && navigate({ to: "/workouts/$id", params: { id: String(w.id) } }),
    });
  return { start, pending };
}

/** `trigger` replaces the default button; it must be a single element that accepts a ref (e.g. a `<button>`). */
export function LogPastDialog({ trigger }: { trigger?: ReactElement } = {}) {
  const { snapshot } = useTraining();
  const navigate = useNavigate();
  const { run, pending } = useMutation();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(() => addDays(today(), -1));
  const [time, setTime] = useState("18:00");
  const [minutes, setMinutes] = useState("60");
  const [title, setTitle] = useState("");
  const [routineId, setRoutineId] = useState<string>("none");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline">
            <CalendarPlus className="size-4" /> Log past workout
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log a past workout</DialogTitle>
          <DialogDescription>
            It's saved as finished. Add exercises next and tick off each set to count it.
          </DialogDescription>
        </DialogHeader>
        <form
          id="log-past"
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const start = new Date(`${date}T${time}`);
            const end = new Date(start.getTime() + Math.max(1, Number(minutes) || 0) * 60_000);
            run(
              () =>
                logPastWorkout({
                  data: {
                    startedAt: start.toISOString(),
                    finishedAt: end.toISOString(),
                    title: title || undefined,
                    routineId: routineId === "none" ? null : Number(routineId),
                  },
                }),
              {
                success: "Workout logged",
                onSuccess: (w) => {
                  setOpen(false);
                  if (w) navigate({ to: "/workouts/$id", params: { id: String(w.id) } });
                },
              },
            );
          }}
        >
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="past-date">Date</Label>
              <Input
                id="past-date"
                type="date"
                required
                max={today()}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="past-time">Started</Label>
              <Input id="past-time" type="time" required value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="past-mins">Minutes</Label>
              <Input
                id="past-mins"
                type="number"
                min={1}
                max={1440}
                required
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="past-routine">Routine</Label>
            <Select value={routineId} onValueChange={setRoutineId}>
              <SelectTrigger id="past-routine" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None: start empty</SelectItem>
                {snapshot.routines.map((r) => (
                  <SelectItem key={r.id} value={String(r.id)}>
                    {r.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="past-title">Title</Label>
            <Input
              id="past-title"
              maxLength={120}
              placeholder="Defaults to the routine name or time of day"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
        </form>
        <DialogFooter>
          <Button type="submit" form="log-past" disabled={pending}>
            Create workout
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
