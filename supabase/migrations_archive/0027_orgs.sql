-- P121: organizations + org_members tables + role enum
--
-- organizations: top-level org entity. Owner is always a profiles row.
-- org_members: membership join table with role.
-- org_role: text CHECK constraint ('owner' | 'admin' | 'member') — avoids
--   the CREATE TYPE IF NOT EXISTS limitation in migration-style SQL.

CREATE TABLE IF NOT EXISTS public.organizations (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL
                CHECK (char_length(name) >= 1 AND char_length(name) <= 80),
  owner_id    uuid        NOT NULL
                REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.org_members (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid        NOT NULL
                REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL
                REFERENCES public.profiles(id) ON DELETE CASCADE,
  role        text        NOT NULL DEFAULT 'member'
                CHECK (role IN ('owner', 'admin', 'member')),
  invited_by  uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_members   ENABLE ROW LEVEL SECURITY;
