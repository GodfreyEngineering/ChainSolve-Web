-- P122: projects.org_id support
--
-- Adds a nullable org_id FK to the projects table so a project can be
-- owned by an organization rather than (or in addition to) an individual.
-- ON DELETE SET NULL ensures projects survive org dissolution.

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS org_id uuid
    REFERENCES public.organizations(id) ON DELETE SET NULL;

-- Index for efficient lookup of all projects belonging to an org.
CREATE INDEX IF NOT EXISTS idx_projects_org_id
  ON public.projects (org_id)
  WHERE org_id IS NOT NULL;
