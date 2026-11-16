import { createRouter } from "@tanstack/react-router";
import { NotFound } from "@/components/spotter/not-found";
import { PageSkeleton } from "@/components/spotter/page-header";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPendingComponent: PageSkeleton,
    defaultNotFoundComponent: () => <NotFound />,
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
