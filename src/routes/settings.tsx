import { createFileRoute } from "@tanstack/react-router";
import { Database, Download, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { FormSection } from "@/components/spotter/form-section";
import { PageHeader } from "@/components/spotter/page-header";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation } from "@/hooks/use-mutation";
import { useSnapshot } from "@/hooks/use-snapshot";
import { slot } from "@/lib/features";
import { importData, loadSampleData, resetAll, saveSettings } from "@/lib/server-fns";
import type { Settings } from "@/lib/types";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings · Spotter" }] }),
  component: SettingsPage,
});

const SECTIONS = slot("settingsSections");

function SettingsPage() {
  const snapshot = useSnapshot();
  const { run, pending } = useMutation();
  const [form, setForm] = useState<Settings & { goalText: string }>({
    ...snapshot.settings,
    goalText: String(snapshot.settings.weeklyGoal),
  });
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setForm({ ...snapshot.settings, goalText: String(snapshot.settings.weeklyGoal) });
  }, [snapshot.settings]);
  const patch = (p: Partial<typeof form>) => setForm((f) => ({ ...f, ...p }));

  const exportJson = () => {
    const blob = new Blob(
      [JSON.stringify({ app: "spotter", version: 1, exportedAt: new Date().toISOString(), ...snapshot }, null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `spotter-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onImport = async (file: File) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      toast.error("That file isn't valid JSON");
      return;
    }
    run(() => importData({ data: { snapshot: parsed } }), { success: "Import complete" });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <PageHeader title="Settings" />

      <FormSection
        title="Profile"
        description="Units only change how numbers are shown and typed; everything is stored the same way."
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () =>
                saveSettings({
                  data: {
                    displayName: form.displayName,
                    weightUnit: form.weightUnit,
                    distanceUnit: form.distanceUnit,
                    weeklyGoal: Number(form.goalText),
                    weekStart: form.weekStart,
                  },
                }),
              { success: "Settings saved" },
            );
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="name">Display name</Label>
            <Input
              id="name"
              value={form.displayName}
              onChange={(e) => patch({ displayName: e.target.value })}
              maxLength={40}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="weight-unit">Weight</Label>
              <Select value={form.weightUnit} onValueChange={(v) => patch({ weightUnit: v as Settings["weightUnit"] })}>
                <SelectTrigger id="weight-unit" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kg">Kilograms (kg)</SelectItem>
                  <SelectItem value="lb">Pounds (lb)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="distance-unit">Distance</Label>
              <Select
                value={form.distanceUnit}
                onValueChange={(v) => patch({ distanceUnit: v as Settings["distanceUnit"] })}
              >
                <SelectTrigger id="distance-unit" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="km">Kilometres (km)</SelectItem>
                  <SelectItem value="mi">Miles (mi)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="goal">Weekly goal (workouts)</Label>
              <Input
                id="goal"
                type="number"
                min={1}
                max={14}
                required
                className="w-28"
                value={form.goalText}
                onChange={(e) => patch({ goalText: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="week-start">Weeks start on</Label>
              <Select value={String(form.weekStart)} onValueChange={(v) => patch({ weekStart: v === "0" ? 0 : 1 })}>
                <SelectTrigger id="week-start" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Monday</SelectItem>
                  <SelectItem value="0">Sunday</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button type="submit" disabled={pending}>
            Save
          </Button>
        </form>
      </FormSection>

      {SECTIONS.map((Section, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: the section list is fixed at build time.
        <Section key={i} />
      ))}

      <FormSection
        title="Your data"
        description="Everything lives in a local SQLite file (data/spotter.db). Back it up as JSON any time."
      >
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportJson}>
            <Download className="size-4" /> Export JSON
          </Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={pending}>
            <Upload className="size-4" /> Import JSON
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImport(f);
              e.target.value = "";
            }}
          />
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => run(() => loadSampleData(), { success: "Sample training merged in" })}
          >
            <Database className="size-4" /> Load sample data
          </Button>
        </div>
      </FormSection>

      <FormSection title="Danger zone" description="Importing replaces all data. Resetting erases it.">
        <div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={pending}>
                <Trash2 className="size-4" /> Reset everything
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Erase all training data?</AlertDialogTitle>
                <AlertDialogDescription>
                  Every workout, routine and setting, and everything else Spotter has saved, will be permanently
                  deleted. Export first if you might want it back.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => run(() => resetAll(), { success: "Clean slate" })}>
                  Erase everything
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </FormSection>
    </div>
  );
}
