import { createRouter } from "@tanstack/react-router";
import { createQueryClient } from "@/lib/query-client";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = createQueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    // defaultPreloadStaleTime intentionally omitted — 0 causes a fetch storm
    // on mobile (every link hover/focus triggers an immediate preload).
  });

  return router;
};
