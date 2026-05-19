import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { StartClient } from "@tanstack/react-start/client";
import { getRouter } from "./router";

const app = (
  <StrictMode>
    <StartClient />
  </StrictMode>
);

const staticRoot = document.getElementById("root");

if (staticRoot) {
  const router = getRouter();
  const rootRoute = (
    router.routesById as unknown as Record<string, { options: { shellComponent?: unknown } }>
  ).__root__;
  rootRoute.options.shellComponent = undefined;

  createRoot(staticRoot).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );
} else {
  hydrateRoot(document, app);
}
