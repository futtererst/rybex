-- Synthetic scratch E fixture only; never include in a normal migration or production seed.
begin;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,confirmation_token,recovery_token,
  email_change_token_new,email_change_token_current,phone_change_token,
  reauthentication_token,email_change,created_at,updated_at)
values ('ac000000-0000-4000-8000-000000000006','00000000-0000-0000-0000-000000000000',
  'authenticated','authenticated','discover-a-finance@synthetic.invalid','!synthetic-no-login!',
  now(),'{}','{}','','','','','','','',now(),now());
insert into public.user_profiles(id,organization_id,workspace_id,active_workspace_id,
  user_id,auth_user_id,email,display_name,status)
values ('ad000000-0000-4000-8000-000000000006','a1000000-0000-4000-8000-000000000001',
  'a2000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001',
  'ac000000-0000-4000-8000-000000000006','ac000000-0000-4000-8000-000000000006',
  'discover-a-finance@synthetic.invalid','Synthetic A finance reviewer','active');
insert into public.workspace_memberships(id,organization_id,workspace_id,user_profile_id,user_id,role,status)
values ('ae000000-0000-4000-8000-000000000006','a1000000-0000-4000-8000-000000000001',
  'a2000000-0000-4000-8000-000000000001','ad000000-0000-4000-8000-000000000006',
  'ac000000-0000-4000-8000-000000000006','billing_commercial_lead','active');
insert into public.d5o_trial_employee_verifications(id,user_id,organization_id,
  verified_by,verification_reference,status)
values ('af000000-0000-4000-8000-000000000006','ac000000-0000-4000-8000-000000000006',
  'a1000000-0000-4000-8000-000000000001','ac000000-0000-4000-8000-000000000004',
  'synthetic finance reviewer fixture; no real employment assertion','verified');
-- The CRM read right is explicit even for the finance actor.
update public.config_permission_definitions
set default_grant_rule_json='{"workspaceRoles":["business_development_lead","billing_commercial_lead"],"organizationScope":"same","verifiedEmployeeRequired":true}'::jsonb
where id='ab700000-0000-4000-8000-000000000002'
  and configuration_version_id='a8000000-0000-4000-8000-000000000001'
  and permission_key='discover.read_opportunities';
insert into public.d5o_trial_opportunity_read_grants(workspace_id,configuration_version_id,
  permission_id,user_id,profile_id,status)
values ('a2000000-0000-4000-8000-000000000001','a8000000-0000-4000-8000-000000000001',
  'ab700000-0000-4000-8000-000000000002','ac000000-0000-4000-8000-000000000006',
  'ad000000-0000-4000-8000-000000000006','active');
insert into public.config_permission_definitions(id,configuration_version_id,permission_key,
  label,permission_scope,default_grant_rule_json,status) values
('ab900000-0000-4000-8000-000000000001','a8000000-0000-4000-8000-000000000001',
  'discover.request_spend','Request bounded Discover investigation spend','organization',
  '{"workspaceRoles":["business_development_lead"],"organizationScope":"same","verifiedEmployeeRequired":true,"maximumAmount":1000,"currency":"USD","maximumDurationDays":30}'::jsonb,'active'),
('ab900000-0000-4000-8000-000000000002','a8000000-0000-4000-8000-000000000001',
  'discover.authorize_spend','Decide bounded Discover investigation spend','organization',
  '{"workspaceRoles":["billing_commercial_lead"],"organizationScope":"same","verifiedEmployeeRequired":true,"maximumAmount":1000,"currency":"USD","maximumDurationDays":30}'::jsonb,'active');
insert into public.d5o_trial_spend_grants(workspace_id,configuration_version_id,
  permission_id,user_id,profile_id,status) values
('a2000000-0000-4000-8000-000000000001','a8000000-0000-4000-8000-000000000001',
  'ab900000-0000-4000-8000-000000000001','ac000000-0000-4000-8000-000000000001',
  'ad000000-0000-4000-8000-000000000001','active'),
('a2000000-0000-4000-8000-000000000001','a8000000-0000-4000-8000-000000000001',
  'ab900000-0000-4000-8000-000000000002','ac000000-0000-4000-8000-000000000006',
  'ad000000-0000-4000-8000-000000000006','active');
commit;
