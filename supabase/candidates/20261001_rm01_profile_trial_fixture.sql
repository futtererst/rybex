-- Disposable scratch E only. Explicit synthetic admin, operations and dispatcher actors.
-- No production permission or policy is changed.
begin;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,confirmation_token,recovery_token,
  email_change_token_new,email_change_token_current,phone_change_token,
  reauthentication_token,email_change,created_at,updated_at)
values
  ('ac000000-0000-4000-8000-000000000007','00000000-0000-0000-0000-000000000000',
   'authenticated','authenticated','rm-a-operations@synthetic.invalid','!synthetic-no-login!',
   now(),'{}','{}','','','','','','','',now(),now()),
  ('ac000000-0000-4000-8000-000000000008','00000000-0000-0000-0000-000000000000',
   'authenticated','authenticated','rm-a-dispatch@synthetic.invalid','!synthetic-no-login!',
   now(),'{}','{}','','','','','','','',now(),now());
insert into public.user_profiles(id,organization_id,workspace_id,active_workspace_id,
  user_id,auth_user_id,email,display_name,status)
values
  ('ad000000-0000-4000-8000-000000000007','a1000000-0000-4000-8000-000000000001',
   'a2000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001',
   'ac000000-0000-4000-8000-000000000007','ac000000-0000-4000-8000-000000000007',
   'rm-a-operations@synthetic.invalid','Synthetic A operations','active'),
  ('ad000000-0000-4000-8000-000000000008','a1000000-0000-4000-8000-000000000001',
   'a2000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001',
   'ac000000-0000-4000-8000-000000000008','ac000000-0000-4000-8000-000000000008',
   'rm-a-dispatch@synthetic.invalid','Synthetic A dispatcher','active');
insert into public.workspace_memberships(id,organization_id,workspace_id,user_profile_id,
  user_id,role,status)
values
  ('ae000000-0000-4000-8000-000000000007','a1000000-0000-4000-8000-000000000001',
   'a2000000-0000-4000-8000-000000000001','ad000000-0000-4000-8000-000000000007',
   'ac000000-0000-4000-8000-000000000007','operations_leader','active'),
  ('ae000000-0000-4000-8000-000000000008','a1000000-0000-4000-8000-000000000001',
   'a2000000-0000-4000-8000-000000000001','ad000000-0000-4000-8000-000000000008',
   'ac000000-0000-4000-8000-000000000008','field_supervisor','active');
insert into public.d5o_trial_employee_verifications(id,user_id,organization_id,
  verified_by,verification_reference,status)
values
  ('af000000-0000-4000-8000-000000000007','ac000000-0000-4000-8000-000000000007',
   'a1000000-0000-4000-8000-000000000001','ac000000-0000-4000-8000-000000000004',
   'synthetic RM operations fixture','verified'),
  ('af000000-0000-4000-8000-000000000008','ac000000-0000-4000-8000-000000000008',
   'a1000000-0000-4000-8000-000000000001','ac000000-0000-4000-8000-000000000004',
   'synthetic RM dispatcher fixture','verified');
insert into public.config_permission_definitions(id,configuration_version_id,
  permission_key,label,permission_scope,default_grant_rule_json,status,created_by)
values
  ('abcc0000-0000-4000-8000-000000000001','a8000000-0000-4000-8000-000000000001',
   'rm.view_profiles','View RM operational profiles','organization',
   '{"workspaceRoles":["admin","operations_leader","field_supervisor"],"organizationScope":"same","verifiedEmployeeRequired":true}'::jsonb,
   'active','ac000000-0000-4000-8000-000000000003'),
  ('abcc0000-0000-4000-8000-000000000002','a8000000-0000-4000-8000-000000000001',
   'rm.create_profile','Create RM operational profile','organization',
   '{"workspaceRoles":["admin"],"organizationScope":"same","verifiedEmployeeRequired":true}'::jsonb,
   'active','ac000000-0000-4000-8000-000000000003'),
  ('abcc0000-0000-4000-8000-000000000003','a8000000-0000-4000-8000-000000000001',
   'rm.edit_profile','Edit RM operational profile','organization',
   '{"workspaceRoles":["admin","operations_leader"],"organizationScope":"same","verifiedEmployeeRequired":true}'::jsonb,
   'active','ac000000-0000-4000-8000-000000000003');
insert into public.d5o_trial_rm_grants(workspace_id,configuration_version_id,
  permission_id,user_id,profile_id,status)
values
  ('a2000000-0000-4000-8000-000000000001','a8000000-0000-4000-8000-000000000001',
   'abcc0000-0000-4000-8000-000000000001','ac000000-0000-4000-8000-000000000003',
   'ad000000-0000-4000-8000-000000000003','active'),
  ('a2000000-0000-4000-8000-000000000001','a8000000-0000-4000-8000-000000000001',
   'abcc0000-0000-4000-8000-000000000002','ac000000-0000-4000-8000-000000000003',
   'ad000000-0000-4000-8000-000000000003','active'),
  ('a2000000-0000-4000-8000-000000000001','a8000000-0000-4000-8000-000000000001',
   'abcc0000-0000-4000-8000-000000000003','ac000000-0000-4000-8000-000000000003',
   'ad000000-0000-4000-8000-000000000003','active'),
  ('a2000000-0000-4000-8000-000000000001','a8000000-0000-4000-8000-000000000001',
   'abcc0000-0000-4000-8000-000000000001','ac000000-0000-4000-8000-000000000007',
   'ad000000-0000-4000-8000-000000000007','active'),
  ('a2000000-0000-4000-8000-000000000001','a8000000-0000-4000-8000-000000000001',
   'abcc0000-0000-4000-8000-000000000003','ac000000-0000-4000-8000-000000000007',
   'ad000000-0000-4000-8000-000000000007','active'),
  ('a2000000-0000-4000-8000-000000000001','a8000000-0000-4000-8000-000000000001',
   'abcc0000-0000-4000-8000-000000000001','ac000000-0000-4000-8000-000000000008',
   'ad000000-0000-4000-8000-000000000008','active');
commit;
