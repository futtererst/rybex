-- Forward-only hardening of the isolated D5O actor read model. The first
-- migration is preserved exactly as applied. Authenticated callers can read
-- only their own active membership and its active workspace through RLS.
grant usage on schema d5o_hosted to authenticated;
grant select on d5o_hosted.memberships, d5o_hosted.workspaces to authenticated;

create policy d5o_hosted_membership_self_read
on d5o_hosted.memberships
for select to authenticated
using (actor_user_id = (select auth.uid()) and status = 'active');

create policy d5o_hosted_workspace_member_read
on d5o_hosted.workspaces
for select to authenticated
using (
  status = 'active'
  and exists (
    select 1 from d5o_hosted.memberships m
    where m.workspace_id = workspaces.id
      and m.actor_user_id = (select auth.uid())
      and m.status = 'active'
  )
);

alter function public.d5o_hosted_actor_v1(text) security invoker;
alter function public.d5o_hosted_workspaces_v1() security invoker;
