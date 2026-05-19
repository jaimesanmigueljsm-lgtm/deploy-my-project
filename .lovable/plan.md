## Visión

Convertir Nest en una plataforma fintech premium tipo Fintonic / Revolut / Copilot Money con 6 pestañas, sistema de inversiones, gestión familiar, analytics avanzado e insights de IA. UI clara, profesional, mobile-first, con tipografía financiera fuerte y animaciones suaves.

---

## Sistema de diseño (base)

Refactor completo de `src/styles.css`:

- **Paleta light premium**: blanco puro, grises fríos (`oklch` slate), verde elegante primario (`#0F9D58`-ish en oklch), azul muted secundario, amber para alertas, rojo suave para negativos.
- **Tokens nuevos**: `--surface`, `--surface-elevated`, `--surface-sunken`, `--border-subtle`, `--positive`, `--negative`, `--neutral`, gradientes suaves, sombras en 3 niveles (`shadow-xs`, `shadow-soft`, `shadow-float`).
- **Tipografía**: Inter Tight para UI + display, `tabular-nums` para todos los números financieros, clase `.num-display` (48-64px, weight 600, tracking tight).
- **Componentes base**: `<StatCard>`, `<MetricRow>`, `<TrendBadge>`, `<ProgressRing>`, `<SectionHeader>`, `<EmptyState>`, `<Sparkline>`. Todos en `src/components/nest/`.
- Animaciones con `framer-motion` (ya disponible si no, lo añado): fade+rise en mount, count-up en métricas, swipe en transacciones.

---

## Cambios de base de datos

Nuevas tablas (todas con RLS `auth.uid() = user_id`):

- `investments` — type (stock/etf/crypto/savings), ticker, name, quantity, avg_cost, current_price, currency, last_updated
- `investment_history` — investment_id, date, value (para gráficos)
- `bills` — name, amount, due_day, category, paid_this_month
- `families` — id, name, owner_id
- `family_members` — family_id, user_id, role (owner/member/child)
- `shared_goals` — family_id, name, target, current, deadline
- Ampliar `profiles`: `health_score`, `family_id`, `notification_prefs jsonb`, `theme`

---

## Estructura de rutas (TanStack)

```
src/routes/
  app.tsx                  (shell + bottom nav 6 tabs)
  app.index.tsx            Home
  app.budget.tsx           Budget (renombre de expenses)
  app.finances.tsx         Finances (NUEVO - investments)
  app.finances.$id.tsx     Detalle de un activo
  app.analytics.tsx        Analytics (rediseño)
  app.family.tsx           Family (NUEVO)
  app.settings.tsx         Profile/Settings
```

Borrar `app.insights.tsx` (insights se integran en Home + Analytics).

---

## Contenido por pestaña

**Home** — hero balance + health score (ProgressRing), 4 KPIs, predicción del mes, distribución por categoría (donut), últimas 5 transacciones, próximos bills, 2-3 AI insights, progreso de metas.

**Budget** — tabs Fixed/Variable, categorías con barras de progreso vs límite, calendario de gastos del mes, FAB para añadir gasto rápido, gestión de recurrentes.

**Finances** — Net worth grande con sparkline, allocation donut (Stocks/ETF/Crypto/Cash), lista de holdings con P/L diario, watchlist, gráfico histórico de portfolio (Recharts area), dividendos estimados.

**Analytics** — Spending trend (line), comparativa mes a mes (bar), heatmap de categorías, top categorías, hábitos ("gastas más los viernes"), insights IA.

**Family** — vista del grupo familiar, miembros, metas compartidas, gastos del grupo, invitar miembro (sin email real, solo mock UI funcional + tabla).

**Profile** — settings, preferencias, notificaciones, plan, seguridad, exportar datos (CSV), toggle dark mode.

---

## IA

Reusar el edge function `generate-insights` existente. Añadir generación de:
- aviso de sobre-gasto (% vs mes anterior)
- oportunidad de ahorro
- predicción de fin de mes
- insight de portfolio (si hay investments)

Mostrar en Home (top 3) y Analytics (lista completa).

---

## Detalles técnicos

- Recharts para todos los gráficos (ya en stack).
- `tabular-nums` en CSS global para `.num`.
- Mobile-first: max-w-2xl, bottom nav fija, safe-area insets.
- Loading states con skeletons (`<Skeleton>`).
- Empty states ilustrados (icono + CTA) en cada tab.
- Dark mode: tokens duales en `:root` y `.dark`, toggle en Profile.
- Datos mock realistas para investments hasta que el usuario añada los suyos (seed opcional en onboarding).

---

## Plan de ejecución (en este orden)

1. **Migración DB** (investments, bills, families, family_members, shared_goals, profile fields)
2. **Design system** — `styles.css` + componentes base en `src/components/nest/`
3. **Shell + nav** — `app.tsx` con 6 tabs nuevas
4. **Home** rediseñada
5. **Budget** (rediseño de expenses)
6. **Finances** (nueva, con CRUD de investments)
7. **Analytics** rediseñada
8. **Family** (nueva)
9. **Profile/Settings** rediseñada con dark mode
10. **AI insights** integradas en Home + Analytics

---

## Lo que NO incluye este plan

- Conexión real a brokers/bancos (Plaid, etc.) — requiere API keys de pago.
- Precios de mercado en vivo — usaremos los precios que el usuario introduzca; opcionalmente puedo añadir un fetch a Yahoo Finance no oficial si lo pides.
- App nativa iOS/Android — sigue siendo PWA web.
- Pagos / suscripciones reales — solo UI del plan.

---

## Pregunta antes de empezar

Esto es trabajo sustancial (probablemente 4-6 mensajes de implementación). **¿Lo construyo todo de seguido (paso 1→10), o prefieres que lo entregue por fases para revisar cada una?** Por defecto haré todo de seguido si confirmas.