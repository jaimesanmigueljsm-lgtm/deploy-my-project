import { createRouter } from "@tanstack/react-router";
import { createQueryClient } from "@/lib/query-client";
import { routeTree } from "./routeTree.gen";

function installSynchronousRouterTransitions(router: ReturnType<typeof createRouter>) {
  const runImmediately = (fn: () => void) => fn();

  Object.defineProperty(router, "startTransition", {
    configurable: true,
    get: () => runImmediately,
    set: () => {
      // Keep route loads outside React.startTransition; otherwise Vercel's
      // static client can freeze when an auth input receives text.
    },
  });
}

export const getRouter = () => {
  const queryClient = createQueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    // defaultPreloadStaleTime intentionally omitted — 0 causes a fetch storm
    // on mobile (every link hover/focus triggers an immediate preload).
  });

  installSynchronousRouterTransitions(router);

  return router;
};
