# Guía de Despliegue — Vercel + Supabase propio

Esta guía te lleva paso a paso desde el estado actual (proyecto en Lovable Cloud) hasta tener la app corriendo en **Vercel** con tu **propia cuenta de Supabase**.

---

## Parte 1 — Crear tu proyecto Supabase

1. Entra en [https://supabase.com](https://supabase.com) y crea un proyecto nuevo.
   - Elige una región cercana (ej. `eu-west-3` para España).
   - Guarda la contraseña de la base de datos en un sitio seguro.
2. Espera a que el proyecto termine de provisionarse (~2 min).

## Parte 2 — Aplicar el esquema de base de datos

1. En tu proyecto Supabase, abre **SQL Editor** (icono `</>` en la barra lateral).
2. Click en **New query**.
3. Abre el archivo `supabase-schema.sql` (descargable desde Lovable, también está en `supabase/migrations/20260519105610_*.sql` del repo).
4. Copia todo el contenido, pégalo en el editor SQL y haz click en **Run**.
5. Verifica en **Table Editor** que aparecen estas tablas:
   - `profiles`, `expenses`, `incomes`, `bills`, `categories`
   - `savings_goals`, `goal_contributions`, `investments`, `investment_history`
   - `families`, `family_members`, `family_invitations`, `shared_goals`
   - `recommendations`, `audit_events`

## Parte 3 — Configurar autenticación

1. **Authentication → Providers → Email**: déjalo habilitado.
2. **Authentication → URL Configuration**:
   - **Site URL**: la URL final donde correrá la app (ej. `https://tu-app.vercel.app`).
   - **Redirect URLs**: añade `https://tu-app.vercel.app/**` y `http://localhost:5173/**` (para desarrollo local).
3. (Opcional) **Google sign-in**:
   - Crea credenciales OAuth en [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
   - Pega el Client ID y Secret en **Authentication → Providers → Google**.

## Parte 4 — Obtener las credenciales

En **Project Settings → API**, copia:

| Variable Vercel                 | Valor en Supabase                     |
| ------------------------------- | ------------------------------------- |
| `VITE_SUPABASE_URL`             | `Project URL`                         |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `anon` / `public` key                 |
| `VITE_SUPABASE_PROJECT_ID`      | El ID del proyecto (parte de la URL)  |
| `SUPABASE_SERVICE_ROLE_KEY`     | `service_role` key (¡SECRETA!)        |

⚠️ La `service_role` key **nunca** debe llevar el prefijo `VITE_` ni exponerse al frontend.

---

## Parte 5 — Conectar el repo a Vercel

1. Entra en [https://vercel.com/new](https://vercel.com/new).
2. **Import Git Repository** → selecciona `jaimesanmigueljsm-lgtm/deploy-my-project`.
3. En la pantalla de configuración:
   - **Framework Preset**: `Other` (lo detecta vía `vercel.json`).
   - **Build Command**: `npm run build` (ya configurado).
   - **Output Directory**: `dist/client` (ya configurado).
4. **Environment Variables** → añade las 4 variables de la Parte 4.
5. Click **Deploy**.

El primer deploy tarda ~3 min. Cuando termine, Vercel te dará una URL `https://tu-app.vercel.app`.

## Parte 6 — Actualizar Supabase con la URL final

Vuelve a Supabase **Authentication → URL Configuration** y actualiza:
- **Site URL**: `https://tu-app.vercel.app`
- **Redirect URLs**: añade `https://tu-app.vercel.app/**`

Esto es crítico para que el login funcione tras el deploy.

---

## Limitaciones conocidas

### Server Functions de TanStack Start
La config actual de `vercel.json` despliega la app como **SPA estática** (solo frontend). Las server functions (archivos `*.functions.ts`) **no se ejecutarán en Vercel** con esta config.

**Impacto en esta app**: mínimo. La gran mayoría del código habla directamente con Supabase desde el navegador usando RLS. Si encuentras alguna pantalla rota tras desplegar, dímelo y migramos esa función al modelo SSR de Vercel.

### Migración de datos existentes
Esta guía crea una BD **vacía**. Si ya creaste usuarios/datos en Lovable Cloud y quieres llevarlos, hay que exportarlos manualmente vía **Database → Backups** en Lovable Cloud y restaurarlos en Supabase. Avísame si lo necesitas.

### Edge Functions
Hay una función en `supabase/functions/generate-insights/`. Esta SÍ se debe desplegar en Supabase con el CLI:

```bash
npx supabase login
npx supabase link --project-ref TU_PROJECT_REF
npx supabase functions deploy generate-insights
```

---

## Checklist final

- [ ] Proyecto Supabase creado
- [ ] `supabase-schema.sql` ejecutado sin errores
- [ ] Email auth habilitado, Site URL configurada
- [ ] Repo importado en Vercel
- [ ] 4 variables de entorno añadidas
- [ ] Deploy exitoso en Vercel
- [ ] Site URL actualizada en Supabase con el dominio Vercel
- [ ] Probado: registro de usuario → onboarding → dashboard

Cualquier paso que falle, copia el error y pégamelo aquí.
