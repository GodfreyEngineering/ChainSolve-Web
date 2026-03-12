-- ============================================================
-- 0009_db_foundations.sql
-- ChainSolve — DB Foundations (OVERNIGHT_TASKS DB-01 through DB-12)
--
-- Apply with:
--   supabase db push            (remote)
--   supabase db reset           (local Docker — re-applies all migrations)
--   Paste into Supabase Dashboard > SQL Editor
--
-- All statements are idempotent — safe to run multiple times.
-- ============================================================

BEGIN;

-- =========================================================================
-- DB-01: Ensure project_assets uses user_id (not owner_id)
-- =========================================================================
-- The baseline has user_id but older production DBs may have owner_id.
-- This idempotently renames it if needed.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'project_assets'
      AND column_name  = 'owner_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'project_assets'
      AND column_name  = 'user_id'
  ) THEN
    ALTER TABLE public.project_assets RENAME COLUMN owner_id TO user_id;
  END IF;
END
$$;

-- Also ensure RLS policies reference user_id correctly
DROP POLICY IF EXISTS assets_select_own ON public.project_assets;
CREATE POLICY assets_select_own ON public.project_assets
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS assets_insert_own ON public.project_assets;
CREATE POLICY assets_insert_own ON public.project_assets
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS assets_update_own ON public.project_assets;
CREATE POLICY assets_update_own ON public.project_assets
  FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS assets_delete_own ON public.project_assets;
CREATE POLICY assets_delete_own ON public.project_assets
  FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));


-- =========================================================================
-- DB-02: Account deletion RPC
-- =========================================================================

CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid        uuid := auth.uid();
  _storage_paths text[];
  _rate_limit_check timestamptz;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Rate limit: only once per 24 hours
  SELECT created_at INTO _rate_limit_check
  FROM public.audit_log
  WHERE user_id = _uid
    AND event_type = 'account_deletion_requested'
    AND created_at > now() - INTERVAL '24 hours'
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'Account deletion can only be requested once per 24 hours'
      USING ERRCODE = 'P0001';
  END IF;

  -- Log the deletion request for audit
  INSERT INTO public.audit_log (user_id, event_type, object_type, object_id, metadata)
  VALUES (_uid, 'account_deletion_requested', 'profile', _uid::text,
          jsonb_build_object('requested_at', now()));

  -- Collect storage paths to purge (caller is responsible for storage cleanup)
  SELECT array_agg(DISTINCT storage_path)
  INTO _storage_paths
  FROM public.project_assets
  WHERE user_id = _uid;

  -- Collect project storage keys
  SELECT array_cat(
    _storage_paths,
    array_agg(DISTINCT storage_key)
  )
  INTO _storage_paths
  FROM public.projects
  WHERE owner_id = _uid AND storage_key IS NOT NULL;

  -- Delete the profile (cascades to all user data via FK ON DELETE CASCADE)
  -- NOTE: auth.users deletion must be done server-side with service role key
  -- This RPC only deletes the profile and returns paths for storage cleanup.
  DELETE FROM public.profiles WHERE id = _uid;

  RETURN jsonb_build_object(
    'success', true,
    'storage_paths_to_purge', COALESCE(to_jsonb(_storage_paths), '[]'::jsonb),
    'deleted_at', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;


-- =========================================================================
-- DB-03: User preferences — add precision & scientific accuracy columns
-- =========================================================================

ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS decimal_places              integer      NOT NULL DEFAULT -1,
  ADD COLUMN IF NOT EXISTS scientific_notation_threshold float8     NOT NULL DEFAULT 1e6,
  ADD COLUMN IF NOT EXISTS thousands_separator          boolean      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS precision_mode               text         NOT NULL DEFAULT 'standard'
    CHECK (precision_mode IN ('standard', 'high', 'scientific')),
  ADD COLUMN IF NOT EXISTS significant_figures          integer      NOT NULL DEFAULT 6,
  ADD COLUMN IF NOT EXISTS angle_unit                   text         NOT NULL DEFAULT 'rad'
    CHECK (angle_unit IN ('rad', 'deg')),
  ADD COLUMN IF NOT EXISTS keybindings                  jsonb        NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS decimal_separator            text         NOT NULL DEFAULT '.'
    CHECK (decimal_separator IN ('.', ',')),
  ADD COLUMN IF NOT EXISTS canvas_snap_to_grid          boolean      NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS canvas_show_minimap          boolean      NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS canvas_show_grid             boolean      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS autosave_enabled             boolean      NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS autosave_interval_seconds    integer      NOT NULL DEFAULT 60;

-- Ensure constraints are valid
ALTER TABLE public.user_preferences
  DROP CONSTRAINT IF EXISTS user_pref_decimal_places_range;
ALTER TABLE public.user_preferences
  ADD CONSTRAINT user_pref_decimal_places_range
    CHECK (decimal_places >= -1 AND decimal_places <= 50);

ALTER TABLE public.user_preferences
  DROP CONSTRAINT IF EXISTS user_pref_sig_figs_range;
ALTER TABLE public.user_preferences
  ADD CONSTRAINT user_pref_sig_figs_range
    CHECK (significant_figures >= 1 AND significant_figures <= 50);

ALTER TABLE public.user_preferences
  DROP CONSTRAINT IF EXISTS user_pref_autosave_interval_range;
ALTER TABLE public.user_preferences
  ADD CONSTRAINT user_pref_autosave_interval_range
    CHECK (autosave_interval_seconds >= 5 AND autosave_interval_seconds <= 3600);


-- =========================================================================
-- DB-04: Display name uniqueness and validation
-- =========================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_name text;

-- Check constraint: alphanumeric + underscore + dash, 3–50 chars
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_display_name_format;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_display_name_format
    CHECK (display_name IS NULL OR display_name ~ '^[a-zA-Z0-9_-]{3,50}$');

-- Case-insensitive unique index on display_name
DROP INDEX IF EXISTS profiles_display_name_ci;
CREATE UNIQUE INDEX profiles_display_name_ci
  ON public.profiles(lower(display_name))
  WHERE display_name IS NOT NULL;

-- RPC: check if a display name is available
CREATE OR REPLACE FUNCTION public.check_display_name_available(p_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_name IS NULL OR p_name !~ '^[a-zA-Z0-9_-]{3,50}$' THEN
    RETURN false;
  END IF;

  RETURN NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE lower(display_name) = lower(p_name)
      AND id <> auth.uid()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_display_name_available(text) TO authenticated;


-- =========================================================================
-- DB-05: Canvas name uniqueness per project
-- =========================================================================

-- Add UNIQUE constraint (project_id, name)
ALTER TABLE public.canvases
  DROP CONSTRAINT IF EXISTS canvases_project_name_unique;
ALTER TABLE public.canvases
  ADD CONSTRAINT canvases_project_name_unique UNIQUE (project_id, name);


-- =========================================================================
-- DB-06: Atomic save RPC — Compare-And-Swap on updated_at
-- =========================================================================

CREATE OR REPLACE FUNCTION public.save_project_metadata(
  p_id              uuid,
  p_known_updated_at timestamptz,
  p_name            text DEFAULT NULL,
  p_storage_key     text DEFAULT NULL,
  p_variables       jsonb DEFAULT NULL
)
RETURNS TABLE(updated_at timestamptz, conflict boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _current_updated_at timestamptz;
  _new_updated_at     timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Read current updated_at with row lock
  SELECT p.updated_at INTO _current_updated_at
  FROM public.projects p
  WHERE p.id = p_id AND p.owner_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project not found or access denied'
      USING ERRCODE = 'P0002';
  END IF;

  -- Check for conflict
  IF _current_updated_at IS DISTINCT FROM p_known_updated_at THEN
    RETURN QUERY SELECT _current_updated_at, true;
    RETURN;
  END IF;

  -- Atomic update
  UPDATE public.projects
  SET
    name        = COALESCE(p_name, name),
    storage_key = COALESCE(p_storage_key, storage_key),
    variables   = COALESCE(p_variables, variables),
    updated_at  = now()
  WHERE id = p_id AND owner_id = auth.uid()
  RETURNING projects.updated_at INTO _new_updated_at;

  RETURN QUERY SELECT _new_updated_at, false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_project_metadata(uuid, timestamptz, text, text, jsonb) TO authenticated;


-- =========================================================================
-- DB-07: High-precision mathematical and physical constants (CODATA 2022)
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.math_constants (
  id              text          PRIMARY KEY,
  name            text          NOT NULL,
  symbol          text,
  value_f64       float8,
  value_string    text          NOT NULL,
  precision_digits int,
  uncertainty     text,
  unit            text,
  description     text,
  category        text          NOT NULL DEFAULT 'mathematical',
  source          text          NOT NULL DEFAULT 'CODATA 2022'
);

COMMENT ON TABLE public.math_constants IS
  'High-precision mathematical and physical constants. Authenticated users may read; only service_role may write.';

ALTER TABLE public.math_constants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS math_constants_read ON public.math_constants;
CREATE POLICY math_constants_read ON public.math_constants
  FOR SELECT
  USING (true);

-- Populate with CODATA 2022 values
INSERT INTO public.math_constants
  (id, name, symbol, value_f64, value_string, precision_digits, uncertainty, unit, description, category, source)
VALUES

-- ── Mathematical constants ────────────────────────────────────────────────
('pi',
 'Pi', 'π',
 3.14159265358979323846,
 '3.14159265358979323846264338327950288419716939937510582097494459230781640628620899862803482534211706',
 100, NULL, NULL,
 'Ratio of a circle''s circumference to its diameter', 'mathematical', 'Computed'),

('e',
 'Euler''s number', 'e',
 2.71828182845904523536,
 '2.71828182845904523536028747135266249775724709369995957496696762772407663035354759457138217852516642',
 100, NULL, NULL,
 'Base of the natural logarithm', 'mathematical', 'Computed'),

('phi',
 'Golden ratio', 'φ',
 1.61803398874989484820,
 '1.61803398874989484820458683436563811772030917980576286213544862270526046281890244970720720418939113',
 100, NULL, NULL,
 'The golden ratio: (1 + √5) / 2', 'mathematical', 'Computed'),

('sqrt2',
 'Square root of 2', '√2',
 1.41421356237309504880,
 '1.41421356237309504880168872420969807856967187537694810011750793230024020325222827893551202827844506',
 100, NULL, NULL,
 'Pythagoras constant', 'mathematical', 'Computed'),

('sqrt3',
 'Square root of 3', '√3',
 1.73205080756887729352,
 '1.73205080756887729352744634150587236694280525381038062805580697945193301690880003708114618675724857',
 100, NULL, NULL,
 'Theodorus constant', 'mathematical', 'Computed'),

('sqrt5',
 'Square root of 5', '√5',
 2.23606797749978969641,
 '2.23606797749978969640917366873127623544061835961152572427089724541052092563780489941441440837878227',
 100, NULL, NULL,
 'Square root of 5', 'mathematical', 'Computed'),

('ln2',
 'Natural log of 2', 'ln 2',
 0.69314718055994530941,
 '0.69314718055994530941723212145817656807550013436025525412068000949339362196969471560586332699641868',
 100, NULL, NULL,
 'Natural logarithm of 2', 'mathematical', 'Computed'),

('ln10',
 'Natural log of 10', 'ln 10',
 2.30258509299404568401,
 '2.30258509299404568401799145468436420760110148862877297603332790096757260967735248023599720508959830',
 100, NULL, NULL,
 'Natural logarithm of 10', 'mathematical', 'Computed'),

('euler_gamma',
 'Euler–Mascheroni constant', 'γ',
 0.57721566490153286060,
 '0.57721566490153286060651209008240243104215933593992359880576723488486772677766467093694706329174675',
 100, NULL, NULL,
 'Limiting difference between harmonic series and natural logarithm', 'mathematical', 'Computed'),

('catalan',
 'Catalan''s constant', 'G',
 0.91596559417721901505,
 '0.91596559417721901505460351493238411077414937428167213426649811962176301977625476947935651292611510',
 100, NULL, NULL,
 'Sum of the Dirichlet beta function at 2', 'mathematical', 'Computed'),

('apery',
 'Apéry''s constant', 'ζ(3)',
 1.20205690315959428539,
 '1.20205690315959428539973816151144999076498629234049888179227155534952508064780109590901210778813419',
 100, NULL, NULL,
 'Value of the Riemann zeta function at 3', 'mathematical', 'Computed'),

-- ── Fundamental physical constants (CODATA 2022) ─────────────────────────
('c',
 'Speed of light in vacuum', 'c',
 299792458.0,
 '299792458',
 NULL, '0 (exact)', 'm s⁻¹',
 'Exact by definition of the metre since 1983', 'physical', 'CODATA 2022'),

('h',
 'Planck constant', 'h',
 6.62607015e-34,
 '6.62607015e-34',
 NULL, '0 (exact)', 'J s',
 'Exact by definition of the kilogram since 2019', 'physical', 'CODATA 2022'),

('hbar',
 'Reduced Planck constant', 'ħ',
 1.054571817e-34,
 '1.0545718176461565e-34',
 NULL, '0 (exact)', 'J s',
 'h / (2π) — exact', 'physical', 'CODATA 2022'),

('k_B',
 'Boltzmann constant', 'k_B',
 1.380649e-23,
 '1.380649e-23',
 NULL, '0 (exact)', 'J K⁻¹',
 'Exact by definition of the kelvin since 2019', 'physical', 'CODATA 2022'),

('e_charge',
 'Elementary charge', 'e',
 1.602176634e-19,
 '1.602176634e-19',
 NULL, '0 (exact)', 'C',
 'Exact by definition of the ampere since 2019', 'physical', 'CODATA 2022'),

('N_A',
 'Avogadro constant', 'N_A',
 6.02214076e23,
 '6.02214076e23',
 NULL, '0 (exact)', 'mol⁻¹',
 'Exact by definition of the mole since 2019', 'physical', 'CODATA 2022'),

('G',
 'Newtonian constant of gravitation', 'G',
 6.67430e-11,
 '6.67430e-11',
 NULL, '1.5e-15', 'm³ kg⁻¹ s⁻²',
 'Universal gravitational constant', 'physical', 'CODATA 2022'),

('g_0',
 'Standard gravity', 'g_0',
 9.80665,
 '9.80665',
 NULL, '0 (exact)', 'm s⁻²',
 'Standard acceleration of gravity — exact by ISO 80000-3', 'physical', 'CODATA 2022'),

('mu_0',
 'Vacuum magnetic permeability', 'μ_0',
 1.25663706212e-6,
 '1.25663706212e-6',
 NULL, '1.9e-16', 'N A⁻²',
 'Magnetic constant', 'physical', 'CODATA 2022'),

('epsilon_0',
 'Vacuum electric permittivity', 'ε_0',
 8.8541878128e-12,
 '8.8541878128e-12',
 NULL, '1.3e-21', 'F m⁻¹',
 'Permittivity of free space: 1/(μ_0 c²)', 'physical', 'CODATA 2022'),

('alpha',
 'Fine-structure constant', 'α',
 7.2973525693e-3,
 '7.2973525693e-3',
 NULL, '1.5e-12', NULL,
 'Dimensionless coupling constant of electromagnetism', 'physical', 'CODATA 2022'),

('R',
 'Molar gas constant', 'R',
 8.314462618,
 '8.314462618',
 NULL, '0 (exact)', 'J mol⁻¹ K⁻¹',
 'k_B × N_A — exact', 'physical', 'CODATA 2022'),

('sigma',
 'Stefan–Boltzmann constant', 'σ',
 5.670374419e-8,
 '5.670374419e-8',
 NULL, '0 (exact)', 'W m⁻² K⁻⁴',
 'Exact: π²k_B⁴/(60ħ³c²)', 'physical', 'CODATA 2022'),

('F',
 'Faraday constant', 'F',
 96485.33212,
 '96485.33212',
 NULL, '0 (exact)', 'C mol⁻¹',
 'N_A × e — exact', 'physical', 'CODATA 2022'),

('Ry',
 'Rydberg constant', 'R_∞',
 10973731.568157,
 '10973731.568157',
 NULL, '1.2e-5', 'm⁻¹',
 'Atomic unit of energy expressed as wavenumber', 'physical', 'CODATA 2022'),

('m_e',
 'Electron mass', 'm_e',
 9.1093837139e-31,
 '9.1093837139e-31',
 NULL, '2.8e-40', 'kg',
 'Rest mass of an electron', 'physical', 'CODATA 2022'),

('m_p',
 'Proton mass', 'm_p',
 1.67262192595e-27,
 '1.67262192595e-27',
 NULL, '5.2e-37', 'kg',
 'Rest mass of a proton', 'physical', 'CODATA 2022'),

('m_n',
 'Neutron mass', 'm_n',
 1.67492750056e-27,
 '1.67492750056e-27',
 NULL, '8.5e-37', 'kg',
 'Rest mass of a neutron', 'physical', 'CODATA 2022'),

('a_0',
 'Bohr radius', 'a_0',
 5.29177210544e-11,
 '5.29177210544e-11',
 NULL, '8.2e-21', 'm',
 'Most probable distance between nucleus and electron in hydrogen ground state', 'physical', 'CODATA 2022'),

('mu_B',
 'Bohr magneton', 'μ_B',
 9.2740100657e-24,
 '9.2740100657e-24',
 NULL, '2.9e-33', 'J T⁻¹',
 'Natural unit for expressing electron magnetic dipole moments', 'physical', 'CODATA 2022'),

('mu_N',
 'Nuclear magneton', 'μ_N',
 5.0507837393e-27,
 '5.0507837393e-27',
 NULL, '1.6e-36', 'J T⁻¹',
 'Natural unit for expressing nuclear magnetic dipole moments', 'physical', 'CODATA 2022'),

('eV',
 'Electron volt', 'eV',
 1.602176634e-19,
 '1.602176634e-19',
 NULL, '0 (exact)', 'J',
 'Energy gained by an electron through 1 V potential difference — exact', 'physical', 'CODATA 2022'),

('u',
 'Atomic mass unit', 'u',
 1.66053906892e-27,
 '1.66053906892e-27',
 NULL, '5.2e-37', 'kg',
 'Unified atomic mass unit: 1/12 of carbon-12 mass', 'physical', 'CODATA 2022')

ON CONFLICT (id) DO UPDATE SET
  value_f64       = EXCLUDED.value_f64,
  value_string    = EXCLUDED.value_string,
  precision_digits = EXCLUDED.precision_digits,
  uncertainty     = EXCLUDED.uncertainty,
  source          = EXCLUDED.source;

-- RPC for constant lookup
CREATE OR REPLACE FUNCTION public.get_constant(p_id text)
RETURNS public.math_constants
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.math_constants WHERE id = p_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_constant(text) TO authenticated, anon;

-- Index for category browsing
CREATE INDEX IF NOT EXISTS idx_math_constants_category ON public.math_constants(category);


-- =========================================================================
-- DB-08: Simulation run history table
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.simulation_runs (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          uuid          NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  canvas_id           uuid          REFERENCES public.canvases(id) ON DELETE SET NULL,
  owner_id            uuid          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  run_type            text          NOT NULL
    CHECK (run_type IN ('parametric', 'optimization', 'montecarlo', 'sweep')),
  config              jsonb         NOT NULL DEFAULT '{}',
  results_storage_path text,
  status              text          NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  started_at          timestamptz,
  completed_at        timestamptz,
  node_count          int,
  eval_time_ms        int,
  error_message       text,
  created_at          timestamptz   NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.simulation_runs IS
  'History of parametric sweeps, optimisations, Monte Carlo, and other runs.';

ALTER TABLE public.simulation_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sim_runs_select_own ON public.simulation_runs;
CREATE POLICY sim_runs_select_own ON public.simulation_runs
  FOR SELECT TO authenticated
  USING (owner_id = (select auth.uid()));

DROP POLICY IF EXISTS sim_runs_insert_own ON public.simulation_runs;
CREATE POLICY sim_runs_insert_own ON public.simulation_runs
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = (select auth.uid()));

DROP POLICY IF EXISTS sim_runs_update_own ON public.simulation_runs;
CREATE POLICY sim_runs_update_own ON public.simulation_runs
  FOR UPDATE TO authenticated
  USING (owner_id = (select auth.uid()))
  WITH CHECK (owner_id = (select auth.uid()));

DROP POLICY IF EXISTS sim_runs_delete_own ON public.simulation_runs;
CREATE POLICY sim_runs_delete_own ON public.simulation_runs
  FOR DELETE TO authenticated
  USING (owner_id = (select auth.uid()));

CREATE INDEX IF NOT EXISTS idx_sim_runs_project  ON public.simulation_runs(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sim_runs_owner    ON public.simulation_runs(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sim_runs_canvas   ON public.simulation_runs(canvas_id) WHERE canvas_id IS NOT NULL;


-- =========================================================================
-- DB-09: Project version history / snapshots
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.project_snapshots (
  id                    uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            uuid          NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  canvas_id             uuid          NOT NULL REFERENCES public.canvases(id) ON DELETE CASCADE,
  owner_id              uuid          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  snapshot_storage_path text          NOT NULL,
  label                 text,
  format_version        int,
  node_count            int,
  edge_count            int,
  created_at            timestamptz   NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.project_snapshots IS
  'Auto-snapshots taken on every manual save. Kept at most 20 per (project_id, canvas_id).';

ALTER TABLE public.project_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS snapshots_select_own ON public.project_snapshots;
CREATE POLICY snapshots_select_own ON public.project_snapshots
  FOR SELECT TO authenticated
  USING (owner_id = (select auth.uid()));

DROP POLICY IF EXISTS snapshots_insert_own ON public.project_snapshots;
CREATE POLICY snapshots_insert_own ON public.project_snapshots
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = (select auth.uid()));

DROP POLICY IF EXISTS snapshots_delete_own ON public.project_snapshots;
CREATE POLICY snapshots_delete_own ON public.project_snapshots
  FOR DELETE TO authenticated
  USING (owner_id = (select auth.uid()));

CREATE INDEX IF NOT EXISTS idx_snapshots_project_canvas
  ON public.project_snapshots(project_id, canvas_id, created_at DESC);

-- Trigger: keep only last 20 snapshots per (project_id, canvas_id)
CREATE OR REPLACE FUNCTION public.enforce_snapshot_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _excess_count int;
BEGIN
  SELECT COUNT(*) - 20 INTO _excess_count
  FROM public.project_snapshots
  WHERE project_id = NEW.project_id
    AND canvas_id  = NEW.canvas_id;

  IF _excess_count > 0 THEN
    DELETE FROM public.project_snapshots
    WHERE id IN (
      SELECT id FROM public.project_snapshots
      WHERE project_id = NEW.project_id
        AND canvas_id  = NEW.canvas_id
      ORDER BY created_at ASC
      LIMIT _excess_count
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_snapshot_limit ON public.project_snapshots;
CREATE TRIGGER trg_enforce_snapshot_limit
  AFTER INSERT ON public.project_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_snapshot_limit();


-- =========================================================================
-- DB-10: Share links table
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.share_links (
  id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid          NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  token       text          NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'base64'),
  created_by  uuid          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  timestamptz   NOT NULL DEFAULT now(),
  expires_at  timestamptz,
  view_count  int           NOT NULL DEFAULT 0,
  is_active   boolean       NOT NULL DEFAULT true
);

COMMENT ON TABLE public.share_links IS
  'Project share links. Active links are viewable by anyone with the token (including anon).';

ALTER TABLE public.share_links ENABLE ROW LEVEL SECURITY;

-- Creator can manage their own links
DROP POLICY IF EXISTS share_links_creator_select ON public.share_links;
CREATE POLICY share_links_creator_select ON public.share_links
  FOR SELECT TO authenticated
  USING (created_by = (select auth.uid()));

DROP POLICY IF EXISTS share_links_creator_insert ON public.share_links;
CREATE POLICY share_links_creator_insert ON public.share_links
  FOR INSERT TO authenticated
  WITH CHECK (created_by = (select auth.uid()));

DROP POLICY IF EXISTS share_links_creator_update ON public.share_links;
CREATE POLICY share_links_creator_update ON public.share_links
  FOR UPDATE TO authenticated
  USING (created_by = (select auth.uid()))
  WITH CHECK (created_by = (select auth.uid()));

DROP POLICY IF EXISTS share_links_creator_delete ON public.share_links;
CREATE POLICY share_links_creator_delete ON public.share_links
  FOR DELETE TO authenticated
  USING (created_by = (select auth.uid()));

-- Anyone can view active links by token (share viewer)
DROP POLICY IF EXISTS share_links_public_read ON public.share_links;
CREATE POLICY share_links_public_read ON public.share_links
  FOR SELECT
  USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

CREATE INDEX IF NOT EXISTS idx_share_links_token     ON public.share_links(token) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_share_links_project   ON public.share_links(project_id);
CREATE INDEX IF NOT EXISTS idx_share_links_creator   ON public.share_links(created_by);


-- =========================================================================
-- DB-11: Node comments table
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.node_comments (
  id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid          NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  canvas_id   uuid          NOT NULL REFERENCES public.canvases(id) ON DELETE CASCADE,
  node_id     text          NOT NULL,
  owner_id    uuid          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content     text          NOT NULL
    CHECK (char_length(content) BETWEEN 1 AND 2000),
  is_resolved boolean       NOT NULL DEFAULT false,
  created_at  timestamptz   NOT NULL DEFAULT now(),
  updated_at  timestamptz   NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.node_comments IS
  'Per-node inline comments/annotations. Scoped to canvas + node_id.';

ALTER TABLE public.node_comments ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_updated_at ON public.node_comments;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.node_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_updated_at();

DROP POLICY IF EXISTS node_comments_select_own ON public.node_comments;
CREATE POLICY node_comments_select_own ON public.node_comments
  FOR SELECT TO authenticated
  USING (owner_id = (select auth.uid()));

DROP POLICY IF EXISTS node_comments_insert_own ON public.node_comments;
CREATE POLICY node_comments_insert_own ON public.node_comments
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = (select auth.uid()));

DROP POLICY IF EXISTS node_comments_update_own ON public.node_comments;
CREATE POLICY node_comments_update_own ON public.node_comments
  FOR UPDATE TO authenticated
  USING (owner_id = (select auth.uid()))
  WITH CHECK (owner_id = (select auth.uid()));

DROP POLICY IF EXISTS node_comments_delete_own ON public.node_comments;
CREATE POLICY node_comments_delete_own ON public.node_comments
  FOR DELETE TO authenticated
  USING (owner_id = (select auth.uid()));

CREATE INDEX IF NOT EXISTS idx_node_comments_canvas  ON public.node_comments(canvas_id);
CREATE INDEX IF NOT EXISTS idx_node_comments_node    ON public.node_comments(canvas_id, node_id);
CREATE INDEX IF NOT EXISTS idx_node_comments_owner   ON public.node_comments(owner_id);


-- =========================================================================
-- DB-12: Marketplace collections (from 0003 — idempotent)
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.marketplace_collections (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text        NOT NULL,
  description     text,
  cover_image_url text,
  item_ids        uuid[]      NOT NULL DEFAULT '{}',
  position        int         NOT NULL DEFAULT 0,
  is_featured     boolean     NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS set_marketplace_collections_updated_at ON public.marketplace_collections;
CREATE TRIGGER set_marketplace_collections_updated_at
  BEFORE UPDATE ON public.marketplace_collections
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_updated_at();

ALTER TABLE public.marketplace_collections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS marketplace_collections_read ON public.marketplace_collections;
CREATE POLICY marketplace_collections_read ON public.marketplace_collections
  FOR SELECT
  USING (true);

CREATE INDEX IF NOT EXISTS idx_marketplace_collections_position
  ON public.marketplace_collections(position);


-- =========================================================================
-- DB-12 (cont): Re-apply corrected RLS SELECT on profiles (from 0008)
-- =========================================================================

DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());


-- =========================================================================
-- DB-12 (cont): Ensure all existing RPCs from 0005-0008 are current
-- =========================================================================

-- get_or_create_profile — primary auth flow profile fetch
CREATE OR REPLACE FUNCTION public.get_or_create_profile()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid    uuid := auth.uid();
  _email  text;
  _meta   jsonb;
  _terms  text;
  _mktg   boolean;
  _result json;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _uid) THEN
    SELECT email, raw_user_meta_data INTO _email, _meta
    FROM auth.users WHERE id = _uid;

    _terms := _meta ->> 'accepted_terms_version';
    _mktg  := COALESCE((_meta ->> 'marketing_opt_in')::boolean, false);

    INSERT INTO public.profiles (
      id, email,
      accepted_terms_version, accepted_terms_at,
      marketing_opt_in, marketing_opt_in_at
    ) VALUES (
      _uid, _email,
      _terms, CASE WHEN _terms IS NOT NULL THEN now() END,
      _mktg,  CASE WHEN _mktg THEN now() END
    ) ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.user_preferences (user_id)
    VALUES (_uid) ON CONFLICT (user_id) DO NOTHING;
  END IF;

  SELECT row_to_json(t) INTO _result FROM (
    SELECT id, email, full_name, avatar_url, display_name,
           plan::text AS plan,
           stripe_customer_id, current_period_end,
           is_developer, is_admin, is_student,
           accepted_terms_version, accepted_terms_at,
           marketing_opt_in, marketing_opt_in_at,
           onboarding_completed_at
    FROM public.profiles
    WHERE id = _uid
  ) t;

  RETURN _result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_profile() TO authenticated;

-- update_my_profile (updated to include display_name)
CREATE OR REPLACE FUNCTION public.update_my_profile(
  p_full_name    text DEFAULT NULL,
  p_avatar_url   text DEFAULT NULL,
  p_display_name text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Validate display_name if provided
  IF p_display_name IS NOT NULL AND p_display_name !~ '^[a-zA-Z0-9_-]{3,50}$' THEN
    RAISE EXCEPTION 'Display name must be 3–50 characters: letters, numbers, _ or -'
      USING ERRCODE = 'P0001';
  END IF;

  -- Check uniqueness
  IF p_display_name IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE lower(display_name) = lower(p_display_name)
      AND id <> auth.uid()
  ) THEN
    RAISE EXCEPTION 'Display name is already taken'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.profiles
  SET full_name    = COALESCE(p_full_name, full_name),
      avatar_url   = COALESCE(p_avatar_url, avatar_url),
      display_name = COALESCE(p_display_name, display_name),
      updated_at   = now()
  WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_my_profile(text, text, text) TO authenticated;


COMMIT;
