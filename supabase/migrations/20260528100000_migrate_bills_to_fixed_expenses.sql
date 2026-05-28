-- Migrate existing bills to fixed expenses.
-- Bills that already have a matching fixed expense this month are skipped.
-- Migrated bills are removed from the bills table.

WITH migrated AS (
  INSERT INTO public.expenses (user_id, amount, description, kind, recurring, spent_at)
  SELECT
    b.user_id,
    b.amount,
    b.name,
    'fixed',
    true,
    MAKE_DATE(
      EXTRACT(YEAR  FROM CURRENT_DATE)::INTEGER,
      EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER,
      LEAST(
        b.due_day,
        EXTRACT(DAY FROM (DATE_TRUNC('month', CURRENT_DATE + INTERVAL '1 month') - INTERVAL '1 day'))::INTEGER
      )
    )
  FROM public.bills b
  WHERE NOT EXISTS (
    SELECT 1 FROM public.expenses e
    WHERE e.user_id = b.user_id
      AND LOWER(TRIM(e.description)) = LOWER(TRIM(b.name))
      AND e.kind = 'fixed'
      AND DATE_TRUNC('month', e.spent_at) = DATE_TRUNC('month', CURRENT_DATE)
  )
  RETURNING user_id, description
)
DELETE FROM public.bills b
USING migrated m
WHERE m.user_id = b.user_id
  AND LOWER(TRIM(m.description)) = LOWER(TRIM(b.name));
