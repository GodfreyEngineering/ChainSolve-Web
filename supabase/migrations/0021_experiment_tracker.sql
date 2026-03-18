-- 0021_experiment_tracker: ML experiment tracking tables (2.103)
--
-- Stores training run metadata, hyperparameters, metrics, and model weights
-- for experiment comparison. Parallel coordinates view is built on top of
-- this table in the UI.
--
-- Schema:
--   experiment_runs  — one row per training run (metrics + params as JSONB)
--   experiment_checkpoints — model weight snapshots at specific epochs

SET search_path = public;

-- ── experiment_runs ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS experiment_runs (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id    uuid        NOT NULL,
  canvas_id     uuid,

  -- Human-readable run name (auto-generated if not provided)
  name          text        NOT NULL DEFAULT '',

  -- ML framework / block type that generated this run
  run_type      text        NOT NULL DEFAULT 'neural_network',

  -- Run lifecycle
  status        text        NOT NULL DEFAULT 'running'
                CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),

  started_at    timestamptz NOT NULL DEFAULT now(),
  finished_at   timestamptz,
  duration_s    float8,

  -- Hyperparameters and config as free-form JSONB
  -- e.g. {"learning_rate": 0.001, "hidden_layers": [64, 32], "batch_size": 32}
  params        jsonb       NOT NULL DEFAULT '{}',

  -- Scalar metrics as free-form JSONB
  -- e.g. {"final_loss": 0.023, "val_accuracy": 0.971, "epochs": 50}
  metrics       jsonb       NOT NULL DEFAULT '{}',

  -- Full metric history per epoch as JSONB array
  -- e.g. [{"epoch": 1, "loss": 1.2, "val_loss": 1.3}, ...]
  history       jsonb,

  -- Tags for filtering / grouping
  tags          text[]      NOT NULL DEFAULT '{}',

  -- Optional free-text notes
  notes         text,

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ── experiment_checkpoints ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS experiment_checkpoints (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id        uuid        NOT NULL REFERENCES experiment_runs(id) ON DELETE CASCADE,
  epoch         int         NOT NULL,

  -- Checkpoint metrics at this epoch
  metrics       jsonb       NOT NULL DEFAULT '{}',

  -- Reference to model weights stored in Supabase Storage
  -- Path: {userId}/experiments/{run_id}/checkpoint_{epoch}.json
  weights_path  text,

  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS experiment_runs_user_id_idx
  ON experiment_runs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS experiment_runs_project_id_idx
  ON experiment_runs (project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS experiment_checkpoints_run_id_idx
  ON experiment_checkpoints (run_id, epoch);

-- ── updated_at trigger ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_experiment_run_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS experiment_runs_updated_at ON experiment_runs;
CREATE TRIGGER experiment_runs_updated_at
  BEFORE UPDATE ON experiment_runs
  FOR EACH ROW EXECUTE FUNCTION update_experiment_run_updated_at();

-- ── Row-Level Security ────────────────────────────────────────────────────────

ALTER TABLE experiment_runs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiment_checkpoints ENABLE ROW LEVEL SECURITY;

-- Users can only see their own experiment runs
CREATE POLICY "experiment_runs: owner read-write" ON experiment_runs
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can only see checkpoints belonging to their own runs
CREATE POLICY "experiment_checkpoints: owner read-write" ON experiment_checkpoints
  FOR ALL USING (
    run_id IN (SELECT id FROM experiment_runs WHERE user_id = auth.uid())
  );
