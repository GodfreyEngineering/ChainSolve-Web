-- Group templates: reusable saved groups (Pro feature).
-- Each template stores its owner_id, name, color, and a jsonb payload
-- containing the nodes + edges subgraph snapshot.

BEGIN;

CREATE TABLE IF NOT EXISTS public.group_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name        text NOT NULL,
  color       text NOT NULL DEFAULT '#1CABB0',
  payload     jsonb NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.group_templates ENABLE ROW LEVEL SECURITY;

-- RLS: users CRUD their own templates only
CREATE POLICY "templates_select_own" ON public.group_templates
  FOR SELECT TO authenticated USING (owner_id = (SELECT auth.uid()));

CREATE POLICY "templates_insert_own" ON public.group_templates
  FOR INSERT TO authenticated WITH CHECK (owner_id = (SELECT auth.uid()));

CREATE POLICY "templates_update_own" ON public.group_templates
  FOR UPDATE TO authenticated USING (owner_id = (SELECT auth.uid()));

CREATE POLICY "templates_delete_own" ON public.group_templates
  FOR DELETE TO authenticated USING (owner_id = (SELECT auth.uid()));

CREATE INDEX IF NOT EXISTS idx_group_templates_owner ON public.group_templates(owner_id);

CREATE TRIGGER set_updated_at_group_templates
  BEFORE UPDATE ON public.group_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

NOTIFY pgrst, 'reload schema';

COMMIT;
