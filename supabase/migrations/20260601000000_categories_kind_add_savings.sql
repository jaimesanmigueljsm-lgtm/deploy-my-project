-- Extend categories_kind_valid constraint to allow 'savings' in addition to
-- the existing 'fixed', 'variable', and 'income' kinds.
ALTER TABLE public.categories
  DROP CONSTRAINT IF EXISTS categories_kind_valid;

ALTER TABLE public.categories
  ADD CONSTRAINT categories_kind_valid
  CHECK (kind IN ('fixed', 'variable', 'income', 'savings'));
