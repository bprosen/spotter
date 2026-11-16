import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

/** A missed rep where the page should be. */
export function NotFound({ what = "page" }: { what?: string }) {
  return (
    <div className="flex flex-col items-start gap-4 py-20">
      <p className="eyebrow text-live">Error 404</p>
      <h1 className="font-display text-7xl sm:text-8xl">No rep</h1>
      <p className="max-w-md text-muted-foreground">
        That {what} doesn't exist. It may have been deleted, or the link is wrong.
      </p>
      <Button asChild>
        <Link to="/">Back to the dashboard</Link>
      </Button>
    </div>
  );
}
