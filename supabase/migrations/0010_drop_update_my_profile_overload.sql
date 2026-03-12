-- ============================================================
-- 0010_drop_update_my_profile_overload.sql
-- Drop the ambiguous 2-param update_my_profile overload.
--
-- Migration 0008 created update_my_profile(text, text).
-- Migration 0009 added update_my_profile(text, text, text) via CREATE OR REPLACE
-- with a different signature — PostgreSQL created a NEW overload instead of
-- replacing the existing one. Both functions now coexist and calling with
-- named params (p_full_name, p_avatar_url) is ambiguous because the 3-param
-- version also accepts 2 params (p_display_name has DEFAULT NULL).
--
-- Fix: drop the old 2-param version. The canonical 3-param version from 0009
-- handles all callers (p_display_name defaults to NULL for existing call sites).
-- ============================================================

BEGIN;

-- Revoke grant on old overload before dropping
REVOKE EXECUTE ON FUNCTION public.update_my_profile(text, text) FROM authenticated;

-- Drop the 2-param overload created in migration 0008.
-- The 3-param version (text, text, text) from migration 0009 remains and is
-- the canonical implementation going forward.
DROP FUNCTION IF EXISTS public.update_my_profile(text, text);

COMMIT;
