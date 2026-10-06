-- Disposable scratch E: explicit synthetic planning right, no production grant.
begin;
insert into public.config_permission_definitions(id,configuration_version_id,
  permission_key,label,permission_scope,default_grant_rule_json,status,created_by)
values('abce0000-0000-4000-8000-000000000001',
  'a8000000-0000-4000-8000-000000000001','rm.plan_shift',
  'Create or cancel tentative RM planning slots','organization',
  '{"workspaceRoles":["admin","operations_leader"],"organizationScope":"same","verifiedEmployeeRequired":true}'::jsonb,
  'active','ac000000-0000-4000-8000-000000000003');
insert into public.d5o_trial_rm_grants(workspace_id,configuration_version_id,
  permission_id,user_id,profile_id,status)
values
  ('a2000000-0000-4000-8000-000000000001','a8000000-0000-4000-8000-000000000001',
   'abce0000-0000-4000-8000-000000000001','ac000000-0000-4000-8000-000000000003',
   'ad000000-0000-4000-8000-000000000003','active'),
  ('a2000000-0000-4000-8000-000000000001','a8000000-0000-4000-8000-000000000001',
   'abce0000-0000-4000-8000-000000000001','ac000000-0000-4000-8000-000000000007',
   'ad000000-0000-4000-8000-000000000007','active');
commit;
