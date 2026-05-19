/**
 * postbuild.js — generates dist/client/index.html for static Vercel deployment.
 *
 * TanStack Start is SSR-first and does not emit index.html during build.
 * This script uses three strategies (in order) to find the client entry JS:
 *   1. Vite manifest  (.vite/manifest.json) — most reliable, always present when build.manifest=true
 *   2. TanStack Start manifest (dist/server/assets/_tanstack-start-manifest_v-*.js) clientEntry field
 *   3. Largest index-*.js in dist/client/assets/ (entry bundle is always largest)
 */

import { readdir, writeFile, readFile, stat } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

const clientDir    = "dist/client";
const clientAssets = "dist/client/assets";
const serverAssets = "dist/server/assets";
const viteManifest = "dist/client/.vite/manifest.json";

// ── 1. Find the CSS bundle ─────────────────────────────────────────────────────
const clientFiles = await readdir(clientAssets);
console.log(`[postbuild] Client assets (${clientFiles.length} files):`, clientFiles.join(", "));

const cssFile = clientFiles.find((f) => f.endsWith(".css"));
if (!cssFile) {
  console.warn("[postbuild] Warning: no CSS file found in dist/client/assets/");
}

// ── 2. Find the root entry JS ─────────────────────────────────────────────────
let entryJs = null;

// Strategy A: Vite manifest (.vite/manifest.json) — isEntry:true marks the root bundle
if (existsSync(viteManifest)) {
  try {
    const manifest = JSON.parse(await readFile(viteManifest, "utf-8"));
    const keys = Object.keys(manifest);
    console.log("[postbuild] Vite manifest entries:", keys.join(", "));
    const entry = Object.values(manifest).find(
      (v) => v.isEntry && typeof v.file === "string" && v.file.endsWith(".js"),
    );
    if (entry) {
      entryJs = `/${entry.file}`;
      console.log(`[postbuild] Strategy A (Vite manifest): ${entryJs}`);
    }
  } catch (e) {
    console.warn("[postbuild] Strategy A failed:", e.message);
  }
}

// Strategy B: TanStack Start server manifest — clientEntry field
if (!entryJs) {
  try {
    const serverFiles = await readdir(serverAssets);
    console.log("[postbuild] Server assets:", serverFiles.join(", "));
    const manifestFile = serverFiles.find((f) => f.startsWith("_tanstack-start-manifest"));
    if (manifestFile) {
      const content = await readFile(join(serverAssets, manifestFile), "utf-8");
      // clientEntry is the definitive field for the root client bundle
      const matchEntry = content.match(/clientEntry:\s*"([^"]+\.js)"/);
      if (matchEntry) {
        entryJs = matchEntry[1];
        console.log(`[postbuild] Strategy B (clientEntry field): ${entryJs}`);
      } else {
        // Fallback within B: __root__ preloads first entry
        const matchRoot = content.match(/__root__[^}]*preloads:\s*\["([^"]+\.js)"/);
        if (matchRoot) {
          entryJs = matchRoot[1];
          console.log(`[postbuild] Strategy B (__root__ preloads): ${entryJs}`);
        }
      }
    } else {
      console.warn("[postbuild] Strategy B: no _tanstack-start-manifest file found in", serverAssets);
    }
  } catch (e) {
    console.warn("[postbuild] Strategy B failed:", e.message);
  }
}

// Strategy C: Largest index-*.js in client assets (entry bundle is always the largest)
if (!entryJs) {
  console.warn("[postbuild] Falling back to Strategy C (largest index-*.js)");
  const indexFiles = clientFiles.filter((f) => /^index-[a-zA-Z0-9_-]+\.js$/.test(f));
  console.log("[postbuild] index-*.js candidates:", indexFiles.join(", "));
  if (indexFiles.length > 0) {
    const withSizes = await Promise.all(
      indexFiles.map(async (f) => ({ f, size: (await stat(join(clientAssets, f))).size })),
    );
    withSizes.sort((a, b) => b.size - a.size);
    console.log(
      "[postbuild] Sizes:",
      withSizes.map(({ f, size }) => `${f}=${size}`).join(", "),
    );
    entryJs = `/assets/${withSizes[0].f}`;
    console.log(`[postbuild] Strategy C: ${entryJs}`);
  }
}

if (!entryJs) {
  console.error("[postbuild] FATAL: could not determine client entry JS.");
  console.error("[postbuild] All client files:", clientFiles.join(", "));
  process.exit(1);
}

console.log(`[postbuild] Entry JS : ${entryJs}`);
console.log(`[postbuild] CSS      : ${cssFile ? `/assets/${cssFile}` : "none"}`);

// ── 3. Write index.html ───────────────────────────────────────────────────────
// Fonts: preconnect + Inter/Inter Tight — mirrors what __root.tsx head() injects via
// TanStack's HeadContent in SSR. In our CSR-only deployment HeadContent never runs,
// so we bake them directly into the HTML shell here.
const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
    <meta name="theme-color" content="#1e2640" media="(prefers-color-scheme: dark)" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="Nest" />
    <meta name="format-detection" content="telephone=no, date=no, address=no" />
    <meta name="description" content="An AI-powered family copilot to track income, expenses and savings goals with calm, beautiful clarity." />
    <title>Nest — Family financial copilot</title>
    <link rel="icon" type="image/svg+xml" href="/icon.svg" />
    <link rel="apple-touch-icon" href="/icon.svg" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Inter+Tight:wght@500;600;700;800&display=swap" />
    ${cssFile ? `<link rel="stylesheet" crossorigin href="/assets/${cssFile}" />` : ""}
  </head>
  <body>
    <!-- SW killer: runs before React, before any module script.
         Kills ANY registered service worker (not just the active controller).
         An old caching SW may be registered but not yet the controller, yet
         still intercept fetches and return cached 401/404 responses.
         After killing, reloads once so the page loads without any SW. -->
    <script>
      (function () {
        if (!("serviceWorker" in navigator)) {
          // No SW support — inject manifest immediately
          var l = document.createElement("link");
          l.rel = "manifest"; l.href = "/manifest.json";
          document.head.appendChild(l);
          return;
        }
        navigator.serviceWorker.getRegistrations().then(function (regs) {
          if (regs.length === 0) {
            // No stale SW — safe to inject manifest now
            var l = document.createElement("link");
            l.rel = "manifest"; l.href = "/manifest.json";
            document.head.appendChild(l);
            return;
          }
          // Stale SW found — kill everything then reload clean
          Promise.all(regs.map(function (r) { return r.unregister(); }))
            .then(function () {
              return "caches" in window
                ? caches.keys().then(function (keys) {
                    return Promise.all(keys.map(function (k) { return caches.delete(k); }));
                  })
                : Promise.resolve();
            })
            .then(function () { location.reload(); })
            .catch(function () { location.reload(); });
        }).catch(function () {
          // getRegistrations failed (e.g. cross-origin) — inject manifest anyway
          var l = document.createElement("link");
          l.rel = "manifest"; l.href = "/manifest.json";
          document.head.appendChild(l);
        });
      })();
    </script>
    <!-- Pre-mount loading indicator — replaced by React during SPA mount.
         If React never mounts (stale cache, missing JS chunks, JS error), the
         fallback below kicks in after 10s and offers a one-tap cache wipe + reload.
         This is the safety net for users stuck with a poisoned service worker. -->
    <div id="root"><div id="__nest_boot" style="position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#f8fafc;font-family:system-ui,sans-serif;gap:12px;padding:24px;text-align:center"><div style="width:40px;height:40px;border:3px solid #e2e8f0;border-top-color:#22c55e;border-radius:50%;animation:__nestspin 0.8s linear infinite"></div><p style="font-size:13px;color:#64748b;margin:0">Loading Nest…</p></div></div><style>@keyframes __nestspin{to{transform:rotate(360deg)}}</style>
    <script>
      // Boot fallback: if React hasn't replaced #__nest_boot after 10s, show a
      // recovery card. The "Recargar limpio" button purges every cache + every
      // service worker registration, then hard-reloads. This rescues users whose
      // browser cached an old PWA service worker pointing to deleted JS chunks.
      (function () {
        var t = setTimeout(function () {
          var boot = document.getElementById("__nest_boot");
          if (!boot) return; // React mounted, fallback not needed
          boot.innerHTML =
            '<div style="max-width:340px"><p style="font-size:15px;color:#0f172a;margin:0 0 8px;font-weight:600">No hemos podido cargar la app</p>' +
            '<p style="font-size:13px;color:#64748b;margin:0 0 16px;line-height:1.5">Suele deberse a una versión antigua en caché. Pulsa el botón para limpiarla y reintentar.</p>' +
            '<button id="__nest_clean" style="padding:10px 20px;background:#22c55e;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer">Recargar limpio</button>' +
            '<p style="font-size:11px;color:#94a3b8;margin:14px 0 0">Si sigue fallando, escribe a soporte y comparte la URL.</p></div>';
          var btn = document.getElementById("__nest_clean");
          if (btn) {
            btn.addEventListener("click", async function () {
              btn.textContent = "Limpiando…";
              btn.disabled = true;
              try {
                if ("serviceWorker" in navigator) {
                  var regs = await navigator.serviceWorker.getRegistrations();
                  await Promise.all(regs.map(function (r) { return r.unregister(); }));
                }
              } catch (_) {}
              try {
                if ("caches" in window) {
                  var keys = await caches.keys();
                  await Promise.all(keys.map(function (k) { return caches.delete(k); }));
                }
              } catch (_) {}
              try { localStorage.clear(); } catch (_) {}
              try { sessionStorage.clear(); } catch (_) {}
              // Hard reload, bypass cache
              location.reload();
            });
          }
        }, 10000);
        // Cancel timer once React mounts (it overwrites the #__nest_boot node)
        var obs = new MutationObserver(function () {
          if (!document.getElementById("__nest_boot")) {
            clearTimeout(t);
            obs.disconnect();
          }
        });
        var root = document.getElementById("root") || document.body;
        obs.observe(root, { childList: true, subtree: true });
      })();
    </script>
    <script type="module" crossorigin src="${entryJs}"></script>
  </body>
</html>
`;

await writeFile(join(clientDir, "index.html"), html, "utf-8");
console.log("[postbuild] dist/client/index.html written successfully.");
