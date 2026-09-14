-- Close Data API gaps flagged by Supabase advisors.
-- Express uses the service role, which bypasses RLS.

drop policy if exists "blemap_deny_data_api" on public.submit_drafts;
create policy "blemap_deny_data_api"
  on public.submit_drafts
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "blemap_deny_data_api" on public.steward_audit;
create policy "blemap_deny_data_api"
  on public.steward_audit
  for all
  to anon, authenticated
  using (false)
  with check (false);

create index if not exists idx_submit_drafts_user_id
  on public.submit_drafts (user_id);

create index if not exists idx_steward_audit_actor_id
  on public.steward_audit (actor_id);

revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

revoke execute on function public.st_estimatedextent(text, text) from public, anon, authenticated;
revoke execute on function public.st_estimatedextent(text, text, text) from public, anon, authenticated;
revoke execute on function public.st_estimatedextent(text, text, text, boolean) from public, anon, authenticated;

-- PostGIS objects (spatial_ref_sys, st_estimatedextent) are owned by supabase_admin.
-- postgres cannot enable RLS on them or revoke their grants; those dashboard
-- warnings remain until PostGIS is reinstalled into the extensions schema.
