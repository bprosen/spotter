import { Pencil } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMutation } from "@/hooks/use-mutation";
import { fromLocalInput, toLocalInput } from "@/lib/dates";
import { updateWorkout } from "@/lib/server-fns";
import type { Workout } from "@/lib/types";

/** Edit a workout's title, note and times. The end time only appears once the workout is finished. */
export function WorkoutDetailsDialog({ workout }: { workout: Workout }) {
  const { run, pending } = useMutation();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(workout.title);
  const [note, setNote] = useState(workout.note ?? "");
  const [start, setStart] = useState(toLocalInput(workout.startedAt));
  const [end, setEnd] = useState(workout.finishedAt ? toLocalInput(workout.finishedAt) : "");

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setTitle(workout.title);
          setNote(workout.note ?? "");
          setStart(toLocalInput(workout.startedAt));
          setEnd(workout.finishedAt ? toLocalInput(workout.finishedAt) : "");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="size-4" /> Details
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Workout details</DialogTitle>
        </DialogHeader>
        <form
          id="workout-details"
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const startedAt = fromLocalInput(start);
            const finishedAt = workout.finishedAt ? fromLocalInput(end) : undefined;
            if (!startedAt || finishedAt === null) {
              toast.error("Enter a valid date and time");
              return;
            }
            run(
              () =>
                updateWorkout({
                  data: { id: workout.id, title, note: note || null, startedAt, ...(finishedAt ? { finishedAt } : {}) },
                }),
              { success: "Saved", onSuccess: () => setOpen(false) },
            );
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="wd-title">Title</Label>
            <Input id="wd-title" required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="wd-start">Started</Label>
              <Input
                id="wd-start"
                type="datetime-local"
                required
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            {workout.finishedAt && (
              <div className="space-y-1.5">
                <Label htmlFor="wd-end">Finished</Label>
                <Input
                  id="wd-end"
                  type="datetime-local"
                  required
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wd-note">Note</Label>
            <Textarea
              id="wd-note"
              rows={3}
              maxLength={2000}
              placeholder="How did it feel?"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </form>
        <DialogFooter>
          <Button type="submit" form="workout-details" disabled={pending}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
