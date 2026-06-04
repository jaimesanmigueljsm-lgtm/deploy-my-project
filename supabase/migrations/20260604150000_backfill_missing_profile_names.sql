-- =============================================================================
-- Backfill missing first_name and financial_username in profiles
-- 2026-06-04
--
-- Issue: Some users created before identity_and_family migration may have
-- NULL first_name or financial_username, causing "?" to appear in family UI.
--
-- Solution: Backfill from auth.users.raw_user_meta_data and auth.users.email
-- =============================================================================

-- Backfill first_name from metadata or email
UPDATE public.profiles
SET first_name = COALESCE(
  (SELECT trim(COALESCE(
    au.raw_user_meta_data->>'first_name',
    split_part(COALESCE(au.raw_user_meta_data->>'full_name', ''), ' ', 1),
    split_part(au.email, '@', 1)
  ))
  FROM auth.users au
  WHERE au.id = profiles.id),
  'User'
)
WHERE first_name IS NULL OR first_name = '';

-- Backfill last_name_1 from metadata or default
UPDATE public.profiles
SET last_name_1 = COALESCE(
  (SELECT trim(COALESCE(
    au.raw_user_meta_data->>'last_name_1',
    NULLIF(split_part(COALESCE(au.raw_user_meta_data->>'full_name', ''), ' ', 2), ''),
    'User'
  ))
  FROM auth.users au
  WHERE au.id = profiles.id),
  'User'
)
WHERE last_name_1 IS NULL OR last_name_1 = '';

-- Backfill financial_username from metadata or email
UPDATE public.profiles
SET financial_username = COALESCE(
  (SELECT lower(trim(COALESCE(
    au.raw_user_meta_data->>'username',
    split_part(au.email, '@', 1)
  )))
  FROM auth.users au
  WHERE au.id = profiles.id),
  'user' || substr(id::text, 1, 8)
)
WHERE financial_username IS NULL OR financial_username = '';

-- Update full_name to match first + last names
UPDATE public.profiles
SET full_name = trim(first_name || ' ' || last_name_1 || COALESCE(' ' || last_name_2, ''))
WHERE full_name IS NULL OR full_name = '' OR full_name != trim(first_name || ' ' || last_name_1 || COALESCE(' ' || last_name_2, ''));

COMMENT ON COLUMN public.profiles.first_name IS
  'User first name, backfilled from auth.users metadata or email if NULL';

-- Verification query (run after migration to check):
-- SELECT id, first_name, last_name_1, financial_username, full_name FROM public.profiles WHERE first_name IS NULL OR financial_username IS NULL;
