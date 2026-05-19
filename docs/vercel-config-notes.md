# `vercel.json` — explicación de cada sección

Vercel rechaza propiedades adicionales en `vercel.json` (no permite claves tipo
`"// comment"`). Las notas que normalmente irían inline las dejo aquí.

## `buildCommand` / `outputDirectory`

`npm run build` ejecuta `vite build && node scripts/postbuild.js`. El segundo
paso genera `dist/client/index.html` (que Vite no emite en modo SSR de
TanStack Start). Vercel sirve `dist/client/` como estático.

## `framework: null`

Le decimos a Vercel que no detecte un framework automático. Si pusiéramos
`vite` Vercel intentaría servir SSR; queremos SPA puro.

## `cleanUrls` + `trailingSlash`

`cleanUrls: true` quita `.html` de las URLs (`/auth.html` → `/auth`).
`trailingSlash: false` redirige `/app/` a `/app` para que coincida con TanStack
Router (que NO usa trailing slash).

## `rewrites`

El regex `/((?!api/|assets/|sw\.js|manifest\.json|icon\.svg|favicon\.ico|robots\.txt|sitemap\.xml).*)`
significa "todas las rutas EXCEPTO esas siete". Las excluidas son archivos
estáticos reales que viven en `dist/client/`. Cualquier otra URL es reescrita
a `/index.html` para que el router en cliente la maneje.

**Por qué importa:** la versión original era `"/(.*)"` (todo se reescribe).
Eso hacía que `/icon.svg` y `/sw.js` también devolvieran HTML, rompiendo la
PWA (icono no carga) y el Service Worker (se registraba HTML como SW).

## `headers` — bloque por bloque

### `/sw.js`
- `Cache-Control: no-cache, no-store, must-revalidate` → el SW siempre se
  descarga fresco. Si lo cacheáramos, un SW roto se quedaría atascado.
- `Service-Worker-Allowed: /` → permite que el SW controle todo el origin.

### `/manifest.json`
- Cache de 24 horas. El manifest cambia raras veces; 1 día es buen
  compromiso.

### `/assets/(.*)`
- Cache de 1 año, `immutable`. Vite fingerprintea cada archivo
  (`index-AbCdEf.js`), así que cualquier asset es seguro de cachear para
  siempre.

### `/((?!assets/).*)` — todo lo que NO sea asset
- `no-cache, no-store, must-revalidate`. El `index.html` (SPA shell) tiene
  que ser fresco en cada visita para que apunte al bundle JS correcto.

### `/(.*)` — headers de seguridad
- `X-Content-Type-Options: nosniff` → previene MIME sniffing.
- `X-Frame-Options: DENY` → bloquea clickjacking (nadie puede meter Nest
  en un `<iframe>`).
- `Referrer-Policy: strict-origin-when-cross-origin` → no filtra paths
  internos al navegar a sitios externos.
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()` →
  desactiva APIs sensibles que Nest no usa.
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` →
  fuerza HTTPS por 2 años. Después de validar en producción, se puede
  enviar el dominio al preload list de Chrome.

## Lo que NO está en este `vercel.json` y debería estar más adelante

- **Content-Security-Policy.** No la añado todavía porque hay que afinar
  qué orígenes externos (Google Fonts, Supabase, Sentry, PostHog) están
  permitidos. Una CSP mal puesta rompe la app entera. Pendiente para
  post-beta.
- **Functions / API routes.** No tenemos. Si en futuro se añaden
  funciones Vercel, irán en `/api/*` (ya está excluido del rewrite).
