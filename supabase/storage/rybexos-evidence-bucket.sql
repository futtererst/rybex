-- RybexOS evidence upload pilot bucket scaffold.
--
-- Scope:
-- - Create a private Supabase Storage bucket for the narrow evidence upload pilot.
-- - Do not add public-read policies.
-- - Do not enable production RLS/storage policy claims in this file.
--
-- Dashboard alternative:
-- 1. Open Supabase Dashboard > Storage.
-- 2. Create bucket: rybexos-evidence.
-- 3. Keep "Public bucket" disabled.
-- 4. Apply file size/type controls according to docs/supabase-storage-evidence-pilot.md.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'rybexos-evidence',
  'rybexos-evidence',
  false,
  10485760,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'text/plain',
    'text/csv',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Future policy guidance only. Do not run as production policy without auth/RLS review.
--
-- - Internal users should read/write only objects under their organization/workspace/project path.
-- - Storage paths should follow:
--   organization_id/workspace_id/project_id/evidence_requirement_id/file_name
-- - Uploads should require an authorized project/module role.
-- - Downloads should use signed URLs and inherit access from the linked
--   workflow_evidence_requirements / entity_attachments records.
-- - Service-role writes are acceptable only for server-side pilot actions.
-- - Public object access is intentionally not configured.
-- - Malware scanning, retention policy enforcement, and object version review
--   remain future production-hardening requirements.

-- Future storage.objects policy scaffold - examples only.
-- Do not run these policies until Supabase Auth, membership mapping, and RLS
-- helper functions from 0004_rls_security_scaffold.sql have been tested.
--
-- Path convention:
--   organization_id/workspace_id/project_id/evidence_requirement_id/file_name
--
-- Select/download should normally happen through short-lived signed URLs created
-- by a server action after checking workflow evidence access. Direct object
-- select policies should be conservative.
--
-- Example select policy, intentionally commented:
--
-- create policy rybexos_evidence_select_member
--   on storage.objects
--   for select
--   to authenticated
--   using (
--     bucket_id = 'rybexos-evidence'
--     and public.is_workspace_member((storage.foldername(name))[2]::uuid)
--   );
--
-- Example insert policy, intentionally commented:
--
-- create policy rybexos_evidence_insert_authorized
--   on storage.objects
--   for insert
--   to authenticated
--   with check (
--     bucket_id = 'rybexos-evidence'
--     and public.has_workspace_permission((storage.foldername(name))[2]::uuid, 'evidence_upload')
--   );
--
-- Example delete policy, intentionally commented:
--
-- create policy rybexos_evidence_delete_admin_only
--   on storage.objects
--   for delete
--   to authenticated
--   using (
--     bucket_id = 'rybexos-evidence'
--     and public.has_workspace_permission((storage.foldername(name))[2]::uuid, 'admin')
--   );
--
-- No public read policy is provided.
-- No anonymous object access should be granted.
-- Signed URL generation should remain server-side.
