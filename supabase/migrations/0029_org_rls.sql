-- P123: org RLS policies (membership + role)
--
-- organizations:
--   SELECT  — any member of the org can see it
--   INSERT  — any authenticated user can create an org (they become owner)
--   UPDATE  — only the org owner can rename the org
--   DELETE  — only the org owner can dissolve the org
--
-- org_members:
--   SELECT  — members can see all memberships in their orgs
--   INSERT  — org owners and admins can invite new members
--   UPDATE  — org owners can promote/demote any member;
--             admins can update 'member'-role rows only
--   DELETE  — org owners/admins can remove members;
--             users can remove themselves (leave org)

-- ── Helper: is the current user a member of the org? ──────────────────────────

-- ── organizations policies ────────────────────────────────────────────────────

DROP POLICY IF EXISTS "orgs_member_select" ON public.organizations;
CREATE POLICY "orgs_member_select" ON public.organizations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_id = organizations.id
        AND user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "orgs_auth_insert" ON public.organizations;
CREATE POLICY "orgs_auth_insert" ON public.organizations
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "orgs_owner_update" ON public.organizations;
CREATE POLICY "orgs_owner_update" ON public.organizations
  FOR UPDATE TO authenticated
  USING  (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "orgs_owner_delete" ON public.organizations;
CREATE POLICY "orgs_owner_delete" ON public.organizations
  FOR DELETE TO authenticated
  USING (owner_id = (SELECT auth.uid()));

-- ── org_members policies ──────────────────────────────────────────────────────

DROP POLICY IF EXISTS "org_members_select" ON public.org_members;
CREATE POLICY "org_members_select" ON public.org_members
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members AS m2
      WHERE m2.org_id = org_members.org_id
        AND m2.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "org_members_insert" ON public.org_members;
CREATE POLICY "org_members_insert" ON public.org_members
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_members AS m
      WHERE m.org_id = org_members.org_id
        AND m.user_id = (SELECT auth.uid())
        AND m.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "org_members_update" ON public.org_members;
CREATE POLICY "org_members_update" ON public.org_members
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members AS m
      WHERE m.org_id = org_members.org_id
        AND m.user_id = (SELECT auth.uid())
        AND (
          m.role = 'owner'
          OR (m.role = 'admin' AND org_members.role = 'member')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_members AS m
      WHERE m.org_id = org_members.org_id
        AND m.user_id = (SELECT auth.uid())
        AND (
          m.role = 'owner'
          OR (m.role = 'admin' AND org_members.role = 'member')
        )
    )
  );

DROP POLICY IF EXISTS "org_members_delete" ON public.org_members;
CREATE POLICY "org_members_delete" ON public.org_members
  FOR DELETE TO authenticated
  USING (
    -- Users can leave (remove themselves)
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.org_members AS m
      WHERE m.org_id = org_members.org_id
        AND m.user_id = (SELECT auth.uid())
        AND m.role IN ('owner', 'admin')
    )
  );
