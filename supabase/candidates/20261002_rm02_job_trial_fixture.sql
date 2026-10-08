-- Disposable scratch E synthetic rights and catalog only.
begin;
update public.d5o_trial_sites set address_text='100 Synthetic Campus Way, Albany, NY'
  where id='8977fdb0-e8b6-4fac-8ceb-bf40ef0654dd'
    and workspace_id='a2000000-0000-4000-8000-000000000001'
    and status='trial_active';
insert into public.d5o_trial_rm_job_catalog(workspace_id,configuration_tenant_id,
  kind,catalog_key,label,status)
values
  ('a2000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000001','job_type','install','Install','active'),
  ('a2000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000001','job_type','decom','Decom','active'),
  ('a2000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000001','job_type','site_survey','Site Survey','active'),
  ('a2000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000001','job_type','pm','Preventive Maintenance','active'),
  ('a2000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000001','priority','normal','Normal','active'),
  ('a2000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000001','priority','urgent','Urgent','active');
insert into public.config_permission_definitions(id,configuration_version_id,
  permission_key,label,permission_scope,default_grant_rule_json,status,created_by)
values
  ('abcd0000-0000-4000-8000-000000000001','a8000000-0000-4000-8000-000000000001',
   'rm.view_jobs','View RM job planning','organization',
   '{"workspaceRoles":["admin","operations_leader","field_supervisor"],"organizationScope":"same","verifiedEmployeeRequired":true}'::jsonb,
   'active','ac000000-0000-4000-8000-000000000003'),
  ('abcd0000-0000-4000-8000-000000000002','a8000000-0000-4000-8000-000000000001',
   'rm.save_job','Save RM job planning','organization',
   '{"workspaceRoles":["admin","operations_leader"],"organizationScope":"same","verifiedEmployeeRequired":true}'::jsonb,
   'active','ac000000-0000-4000-8000-000000000003');
insert into public.d5o_trial_rm_grants(workspace_id,configuration_version_id,
  permission_id,user_id,profile_id,status)
values
  ('a2000000-0000-4000-8000-000000000001','a8000000-0000-4000-8000-000000000001',
   'abcd0000-0000-4000-8000-000000000001','ac000000-0000-4000-8000-000000000003',
   'ad000000-0000-4000-8000-000000000003','active'),
  ('a2000000-0000-4000-8000-000000000001','a8000000-0000-4000-8000-000000000001',
   'abcd0000-0000-4000-8000-000000000002','ac000000-0000-4000-8000-000000000003',
   'ad000000-0000-4000-8000-000000000003','active'),
  ('a2000000-0000-4000-8000-000000000001','a8000000-0000-4000-8000-000000000001',
   'abcd0000-0000-4000-8000-000000000001','ac000000-0000-4000-8000-000000000007',
   'ad000000-0000-4000-8000-000000000007','active'),
  ('a2000000-0000-4000-8000-000000000001','a8000000-0000-4000-8000-000000000001',
   'abcd0000-0000-4000-8000-000000000002','ac000000-0000-4000-8000-000000000007',
   'ad000000-0000-4000-8000-000000000007','active'),
  ('a2000000-0000-4000-8000-000000000001','a8000000-0000-4000-8000-000000000001',
   'abcd0000-0000-4000-8000-000000000001','ac000000-0000-4000-8000-000000000008',
   'ad000000-0000-4000-8000-000000000008','active');
commit;
