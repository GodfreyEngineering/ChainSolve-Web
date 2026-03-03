-- J3-1: Set developer role for the primary developer account.
-- Developer role unlocks all features and dev tools (is_developer = true).
-- This is enforced server-side via RLS and the entitlements layer.

UPDATE profiles
SET is_developer = true
WHERE email = 'ben.godfrey@chainsolve.co.uk';
