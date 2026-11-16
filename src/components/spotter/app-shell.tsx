import { Link, useLocation } from "@tanstack/react-router";
import { Dumbbell, History, LayoutGrid, ListChecks, Menu, Play, Settings } from "lucide-react";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useTraining } from "@/hooks/use-snapshot";
import { type NavItem, slot } from "@/lib/features";
import { countedSets } from "@/lib/training";
import { cn } from "@/lib/utils";
import { Elapsed } from "./elapsed";
import { ThemeToggle } from "./theme-toggle";

/** Base pages, then each feature's links (primary ones first). Settings is pinned separately. */
function buildNav(): NavItem[] {
  const features = slot("nav");
  return [
    { to: "/", label: "Dashboard", icon: LayoutGrid },
    { to: "/workouts", label: "History", icon: History },
    { to: "/routines", label: "Routines", icon: ListChecks },
    { to: "/exercises", label: "Exercises", icon: Dumbbell },
    ...features.filter((n) => n.primary),
    ...features.filter((n) => !n.primary),
  ];
}

const NAV = buildNav();
const SETTINGS: NavItem = { to: "/settings", label: "Settings", icon: Settings };
/** The mobile tabs around the start button; everything else is under "More". */
const TABS = NAV.slice(0, 3);

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function LiveDot({ className }: { className?: string }) {
  return (
    <span className={cn("relative flex size-2", className)} aria-hidden>
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-live opacity-70" />
      <span className="relative inline-flex size-2 rounded-full bg-live" />
    </span>
  );
}

export function Brand({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn("flex items-center gap-2.5", className)} aria-label="Spotter home">
      <span className="grid size-8 place-items-center rounded-md bg-volt text-volt-foreground">
        <Dumbbell className="size-4" strokeWidth={2.5} />
      </span>
      <span className="font-display text-2xl tracking-wide">Spotter</span>
    </Link>
  );
}

function RailLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const on = isActive(pathname, item.to);
  return (
    <Link
      to={item.to}
      className={cn(
        "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        on
          ? "bg-white/[0.06] text-rail-foreground"
          : "text-rail-muted hover:bg-white/[0.04] hover:text-rail-foreground",
      )}
    >
      <span
        className={cn("absolute inset-y-1.5 left-0 w-[3px] rounded-full", on ? "bg-volt" : "bg-transparent")}
        aria-hidden
      />
      <item.icon className="size-4" />
      {item.label}
    </Link>
  );
}

/** The bottom of the rail: the live workout, or a big start button. */
function SessionCard() {
  const { active } = useTraining();
  if (!active) {
    return (
      <Link
        to="/train"
        className="flex items-center justify-between rounded-md bg-volt px-4 py-3 text-volt-foreground transition-transform hover:-translate-y-0.5"
      >
        <span className="font-display text-xl">Start workout</span>
        <Play className="size-4 fill-current" />
      </Link>
    );
  }
  const done = active.exercises.reduce((n, l) => n + countedSets(l).length, 0);
  return (
    <Link
      to="/workouts/$id"
      params={{ id: String(active.id) }}
      className="block rounded-md border border-live/40 bg-live/10 p-3 transition-colors hover:bg-live/15"
    >
      <span className="eyebrow flex items-center gap-2 text-live">
        <LiveDot /> Live
      </span>
      <p className="mt-1.5 truncate text-sm font-semibold text-rail-foreground">{active.title}</p>
      <div className="mt-1 flex items-baseline justify-between">
        <Elapsed since={active.startedAt} className="num text-2xl font-semibold text-rail-foreground" />
        <span className="num text-xs text-rail-muted">{done} sets</span>
      </div>
    </Link>
  );
}

/** Desktop: a fixed dark rail on the left. */
export function Sidebar() {
  const pathname = useLocation({ select: (l) => l.pathname });
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-rail-border bg-rail text-rail-foreground lg:flex">
      <div className="px-5 pt-6 pb-8">
        <Brand />
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3" aria-label="Main">
        <p className="eyebrow px-3 pb-2 text-rail-muted">Training</p>
        {NAV.map((n) => (
          <RailLink key={n.to} item={n} pathname={pathname} />
        ))}
      </nav>
      <div className="space-y-3 px-3 pb-4">
        <SessionCard />
        <div className="flex items-center justify-between border-t border-rail-border pt-3">
          <div className="flex-1">
            <RailLink item={SETTINGS} pathname={pathname} />
          </div>
          <ThemeToggle className="text-rail-muted hover:bg-white/[0.06] hover:text-rail-foreground" />
        </div>
      </div>
    </aside>
  );
}

/** Mobile: a slim dark bar at the top. */
export function MobileTopBar() {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-rail-border bg-rail px-4 text-rail-foreground lg:hidden">
      <Brand />
      <ThemeToggle className="text-rail-muted hover:bg-white/[0.06] hover:text-rail-foreground" />
    </header>
  );
}

/** Mobile: three tabs, a raised start/live button in the middle, and "More". */
export function MobileTabBar() {
  const pathname = useLocation({ select: (l) => l.pathname });
  const { active } = useTraining();
  const rest = [...NAV.filter((n) => !TABS.includes(n)), SETTINGS];
  const tab = (on: boolean) =>
    cn(
      "flex flex-col items-center gap-1 pt-2.5 pb-2 text-[10px] font-semibold tracking-wide uppercase",
      on ? "text-volt" : "text-rail-muted",
    );
  const tabLink = (n: NavItem) => (
    <Link key={n.to} to={n.to} className={tab(isActive(pathname, n.to))}>
      <n.icon className="size-5" />
      {n.label}
    </Link>
  );
  const center = active ? (
    <Link
      to="/workouts/$id"
      params={{ id: String(active.id) }}
      className="flex flex-col items-center"
      aria-label="Resume workout"
    >
      <span className="-mt-5 grid size-14 place-items-center rounded-full bg-live text-white shadow-lg ring-4 ring-rail">
        <LiveDot className="[&>span]:bg-white" />
      </span>
      <Elapsed since={active.startedAt} className="num mt-1 text-[10px] text-live" />
    </Link>
  ) : (
    <Link to="/train" className="flex flex-col items-center" aria-label="Start workout">
      <span className="-mt-5 grid size-14 place-items-center rounded-full bg-volt text-volt-foreground shadow-lg ring-4 ring-rail">
        <Play className="size-5 fill-current" />
      </span>
      <span className="mt-1 text-[10px] font-semibold tracking-wide text-rail-muted uppercase">Start</span>
    </Link>
  );
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-rail-border bg-rail pb-[env(safe-area-inset-bottom)] lg:hidden"
      aria-label="Main"
    >
      {TABS.slice(0, 2).map(tabLink)}
      {center}
      {tabLink(TABS[2])}
      <Sheet>
        <SheetTrigger className={tab(rest.some((n) => isActive(pathname, n.to)))}>
          <Menu className="size-5" />
          More
        </SheetTrigger>
        <SheetContent side="bottom" className="pb-[calc(env(safe-area-inset-bottom)+1rem)]">
          <SheetHeader>
            <SheetTitle>More</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-3 gap-2 px-4">
            {rest.map((n) => (
              <SheetClose key={n.to} asChild>
                <Link
                  to={n.to}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-md border p-3 text-xs font-medium",
                    isActive(pathname, n.to) && "border-foreground",
                  )}
                >
                  <n.icon className="size-5" />
                  {n.label}
                </Link>
              </SheetClose>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  );
}
