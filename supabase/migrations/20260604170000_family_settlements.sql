-- =============================================================================
-- Family Settlements (Ingresos/Pagos entre miembros)
-- 2026-06-04
--
-- Nueva funcionalidad para registrar pagos de deudas entre miembros de grupos.
-- Permite liquidar balances sin crear gastos adicionales.
-- =============================================================================

-- Crear tabla de settlements (liquidaciones/ingresos)
CREATE TABLE IF NOT EXISTS public.family_settlements (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id       uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  from_user_id    uuid NOT NULL,  -- Quien envía el dinero
  to_user_id      uuid NOT NULL,  -- Quien recibe el dinero
  amount          numeric(12,2) NOT NULL CHECK (amount > 0),
  description     text,
  settled_at      timestamptz NOT NULL DEFAULT now(),  -- Fecha del pago
  created_by      uuid NOT NULL,  -- Quien registró el pago en la app
  created_at      timestamptz NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT different_users CHECK (from_user_id != to_user_id)
);

-- Indexes para queries eficientes
CREATE INDEX idx_family_settlements_family ON public.family_settlements(family_id);
CREATE INDEX idx_family_settlements_from ON public.family_settlements(from_user_id);
CREATE INDEX idx_family_settlements_to ON public.family_settlements(to_user_id);
CREATE INDEX idx_family_settlements_settled_at ON public.family_settlements(settled_at DESC);

-- RLS: Solo miembros del grupo pueden ver/crear settlements
ALTER TABLE public.family_settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "family_settlements_select" ON public.family_settlements
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.family_members
      WHERE family_id = family_settlements.family_id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "family_settlements_insert" ON public.family_settlements
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.family_members
      WHERE family_id = family_settlements.family_id
        AND user_id = auth.uid()
    )
    AND created_by = auth.uid()
  );

CREATE POLICY "family_settlements_delete" ON public.family_settlements
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.family_members
      WHERE family_id = family_settlements.family_id
        AND user_id = auth.uid()
    )
    AND created_by = auth.uid()
  );

-- Comentarios
COMMENT ON TABLE public.family_settlements IS
  'Registra pagos/liquidaciones de deudas entre miembros de un grupo familiar';

COMMENT ON COLUMN public.family_settlements.from_user_id IS
  'Usuario que envía el dinero (paga su deuda)';

COMMENT ON COLUMN public.family_settlements.to_user_id IS
  'Usuario que recibe el dinero (cobra lo que le deben)';

COMMENT ON COLUMN public.family_settlements.settled_at IS
  'Fecha real en que se hizo el pago (puede ser anterior al registro)';

COMMENT ON COLUMN public.family_settlements.created_by IS
  'Usuario que registró el settlement en la app (puede ser diferente de from_user_id)';
