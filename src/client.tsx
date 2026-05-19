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
  const rootRoute = router.routesById.__root__ as { options: { shellComponent?: unknown } };
  rootRoute.options.shellComponent = undefined;

  createRoot(staticRoot).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );
} else {
  hydrateRoot(document, app);
}
