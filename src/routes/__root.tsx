import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Providers } from "@/components/providers";
import { MobileTabBar, MobileTopBar, Sidebar } from "@/components/spotter/app-shell";
import { slot } from "@/lib/features";
import { getSnapshot } from "@/lib/server-fns";
import appCss from "@/styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Spotter — your training log" },
      { name: "description", content: "Log your workouts, follow your routines and watch your lifts go up." },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      {
        rel: "icon",
        href: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🏋️</text></svg>",
      },
    ],
  }),
  // The whole dataset is small, so every page reads from this one loader. Mutations invalidate it.
  loader: () => getSnapshot(),
  shellComponent: RootDocument,
  component: RootLayout,
});

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full antialiased">
      <head>
        <HeadContent />
      </head>
      <body className="min-h-full">
        <Providers>{children}</Providers>
        <Scripts />
      </body>
    </html>
  );
}

const OVERLAYS = slot("overlays");

function RootLayout() {
  return (
    <div className="min-h-screen lg:pl-60">
      <Sidebar />
      <MobileTopBar />
      <main className="mx-auto w-full max-w-5xl px-4 pt-6 pb-32 sm:px-6 lg:px-10 lg:pt-10 lg:pb-16">
        <Outlet />
      </main>
      <MobileTabBar />
      {OVERLAYS.map((Overlay, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: the overlay list is fixed at build time.
        <Overlay key={i} />
      ))}
    </div>
  );
}
