import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { NotFound } from "@/components/spotter/not-found";
import { PageHeader } from "@/components/spotter/page-header";
import { RoutineForm } from "@/components/spotter/routine-form";
import { useMutation } from "@/hooks/use-mutation";
import { useTraining } from "@/hooks/use-snapshot";
import { updateRoutine } from "@/lib/server-fns";

export const Route = createFileRoute("/routines/$id/edit")({
  head: () => ({ meta: [{ title: "Edit routine · Spotter" }] }),
  component: EditRoutine,
});

function EditRoutine() {
  const { id } = Route.useParams();
  const { routineById } = useTraining();
  const navigate = useNavigate();
  const { run, pending } = useMutation();
  const routine = routineById.get(Number(id));
  if (!routine) return <NotFound what="routine" />;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={`Edit ${routine.title}`} />
      <RoutineForm
        initial={routine}
        pending={pending}
        submitLabel="Save changes"
        onSubmit={(fields) =>
          run(() => updateRoutine({ data: { id: routine.id, ...fields } }), {
            success: "Routine saved",
            onSuccess: () => navigate({ to: "/routines/$id", params: { id } }),
          })
        }
      />
    </div>
  );
}
