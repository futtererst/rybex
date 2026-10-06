-- Disposable tenant-A fixture only. Separate explicit submission and receiving rights.
-- Do not apply to the recovery source or production configuration.
begin;
insert into public.config_permission_definitions(id,configuration_version_id,permission_key,
  label,permission_scope,default_grant_rule_json,status,created_by)
values
  ('ab990000-0000-4000-8000-000000000001','a8000000-0000-4000-8000-000000000001',
   'discover.submit_d2_handoff','Submit D2 receiving brief','organization',
   '{"workspaceRoles":["business_development_lead"],"organizationScope":"same","verifiedEmployeeRequired":true}'::jsonb,
   'active','ac000000-0000-4000-8000-000000000001'),
  ('ab990000-0000-4000-8000-000000000002','a8000000-0000-4000-8000-000000000001',
   'define.receive_handoff','Receive D2 brief','organization',
   '{"workspaceRoles":["business_development_lead"],"organizationScope":"same","verifiedEmployeeRequired":true}'::jsonb,
   'active','ac000000-0000-4000-8000-000000000005');
insert into public.d5o_trial_d2_handoff_grants(workspace_id,configuration_version_id,
  permission_id,user_id,profile_id,status)
values
  ('a2000000-0000-4000-8000-000000000001','a8000000-0000-4000-8000-000000000001',
   'ab990000-0000-4000-8000-000000000001','ac000000-0000-4000-8000-000000000001',
   'ad000000-0000-4000-8000-000000000001','active'),
  ('a2000000-0000-4000-8000-000000000001','a8000000-0000-4000-8000-000000000001',
   'ab990000-0000-4000-8000-000000000002','ac000000-0000-4000-8000-000000000005',
   'ad000000-0000-4000-8000-000000000005','active');
commit;
