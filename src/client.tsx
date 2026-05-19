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
  createRoot(staticRoot).render(
    <StrictMode>
      <RouterProvider router={getRouter()} />
    </StrictMode>,
  );
} else {
  hydrateRoot(document, app);
}
