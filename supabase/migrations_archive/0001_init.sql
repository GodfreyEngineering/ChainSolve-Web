-- ============================================================
-- ChainSolve — Initial schema migration
-- Run once against your Supabase project via the SQL editor
-- or: supabase db push
-- ============================================================

-- -------------------------------------------------------
-- 1. Custom types
-- -------------------------------------------------------
CREATE TYPE plan_status AS ENUM ('free', 'trialing', 'pro', 'past_due', 'canceled');


-- -------------------------------------------------------
-- 2. Core tables
-- -------------------------------------------------------

-- profiles: one row per auth.users entry, created by trigger
CREATE TABLE IF NOT EXISTS profiles (
  id                    UUID         PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email                 TEXT,
  full_name             TEXT,
  avatar_url            TEXT,
  plan                  plan_status  NOT NULL DEFAULT 'free',
  stripe_customer_id    TEXT         UNIQUE,
  stripe_subscription_id TEXT,
  current_period_end    TIMESTAMPTZ,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- projects: top-level work units per user
CREATE TABLE IF NOT EXISTS projects (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- fs_items: virtual file-system tree scoped to a project
CREATE TABLE IF NOT EXISTS fs_items (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  parent_id   UUID        REFERENCES fs_items(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  type        TEXT        NOT NULL CHECK (type IN ('file', 'folder')),
  content     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- project_assets: files uploaded to storage and linked to projects
CREATE TABLE IF NOT EXISTS project_assets (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL,
  storage_path TEXT        NOT NULL,
  mime_type    TEXT,
  size         BIGINT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- stripe_events: audit log of every Stripe webhook received
CREATE TABLE IF NOT EXISTS stripe_events (
  id         TEXT        PRIMARY KEY,   -- Stripe event ID (evt_...)
  type       TEXT        NOT NULL,
  payload    JSONB       NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- -------------------------------------------------------
-- 3. Performance indexes
-- -------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_projects_user_id          ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_fs_items_project_id       ON fs_items(project_id);
CREATE INDEX IF NOT EXISTS idx_fs_items_user_id          ON fs_items(user_id);
CREATE INDEX IF NOT EXISTS idx_fs_items_parent_id        ON fs_items(parent_id);
CREATE INDEX IF NOT EXISTS idx_project_assets_project_id ON project_assets(project_id);
CREATE INDEX IF NOT EXISTS idx_project_assets_user_id    ON project_assets(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer  ON profiles(stripe_customer_id);


-- -------------------------------------------------------
-- 4. updated_at trigger
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON fs_items
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- -------------------------------------------------------
-- 5. Auto-create profile on new user signup
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger first so migration is idempotent
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- -------------------------------------------------------
-- 6. Enable Row-Level Security
-- -------------------------------------------------------
ALTER TABLE profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects       ENABLE ROW LEVEL SECURITY;
ALTER TABLE fs_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_events  ENABLE ROW LEVEL SECURITY;


-- -------------------------------------------------------
-- 7. RLS policies — profiles
-- -------------------------------------------------------
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());


-- -------------------------------------------------------
-- 8. RLS policies — projects
-- -------------------------------------------------------
CREATE POLICY "Users can view their own projects"
  ON projects FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create projects"
  ON projects FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own projects"
  ON projects FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own projects"
  ON projects FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());


-- -------------------------------------------------------
-- 9. RLS policies — fs_items
-- -------------------------------------------------------
CREATE POLICY "Users can view their own fs_items"
  ON fs_items FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create fs_items"
  ON fs_items FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own fs_items"
  ON fs_items FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own fs_items"
  ON fs_items FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());


-- -------------------------------------------------------
-- 10. RLS policies — project_assets
-- -------------------------------------------------------
CREATE POLICY "Users can view their own project_assets"
  ON project_assets FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create project_assets"
  ON project_assets FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own project_assets"
  ON project_assets FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own project_assets"
  ON project_assets FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- stripe_events: no user-level access; service_role bypasses RLS by default.
-- Enabling RLS with zero policies = no authenticated user can read/write.


-- -------------------------------------------------------
-- 11. Storage buckets
-- -------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES
  ('projects', 'projects', false, 52428800),   -- 50 MB
  ('uploads',  'uploads',  false, 52428800)
ON CONFLICT (id) DO NOTHING;


-- -------------------------------------------------------
-- 12. Storage RLS policies
-- Files must be stored under  <user_id>/...  prefix
-- -------------------------------------------------------

-- projects bucket
CREATE POLICY "projects bucket: users select own files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'projects'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "projects bucket: users insert own files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'projects'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "projects bucket: users update own files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'projects'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "projects bucket: users delete own files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'projects'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- uploads bucket
CREATE POLICY "uploads bucket: users select own files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "uploads bucket: users insert own files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "uploads bucket: users update own files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "uploads bucket: users delete own files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
