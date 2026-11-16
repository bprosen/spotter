import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/spotter/page-header";
import { RoutineForm } from "@/components/spotter/routine-form";
import { useMutation } from "@/hooks/use-mutation";
import { createRoutine } from "@/lib/server-fns";

export const Route = createFileRoute("/routines/new")({
  head: () => ({ meta: [{ title: "New routine · Spotter" }] }),
  component: NewRoutine,
});

function NewRoutine() {
  const navigate = useNavigate();
  const { run, pending } = useMutation();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New routine" />
      <RoutineForm
        pending={pending}
        submitLabel="Create routine"
        onSubmit={(fields) =>
          run(() => createRoutine({ data: fields }), {
            success: "Routine created",
            onSuccess: (r) => r && navigate({ to: "/routines/$id", params: { id: String(r.id) } }),
          })
        }
      />
    </div>
  );
}
