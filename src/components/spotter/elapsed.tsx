import { useEffect, useState } from "react";
import { formatDuration } from "@/lib/units";

/** A clock counting up from `since`. Renders nothing until mounted, so server and client markup agree. */
export function Elapsed({ since, className }: { since: string; className?: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (now == null) return <span className={className}>&nbsp;</span>;
  const seconds = Math.max(0, (now - new Date(since).getTime()) / 1000);
  return (
    <span className={className} role="timer">
      {seconds < 60 ? `0:${String(Math.floor(seconds)).padStart(2, "0")}` : formatDuration(seconds)}
    </span>
  );
}
