# Supabase Storage Evidence Pilot

## Scope
This pilot lets RybexOS attach one file to a workflow evidence requirement when database mode and evidence database mode are explicitly enabled. It is not full production document management.

Default behavior remains local/demo evidence state.

## Bucket Strategy
Recommended bucket: `rybexos-evidence`

The bucket should be private. Do not configure public-read access.

Setup scaffold:
- `supabase/storage/rybexos-evidence-bucket.sql`

If bucket creation is handled in the Supabase dashboard:
1. Create bucket `rybexos-evidence`.
2. Leave public access disabled.
3. Limit files to 10 MB for the pilot.
4. Restrict file types to PDF, images, plain text, CSV, DOCX, and XLSX.

## Path Convention
Storage objects should use:

```text
organization_id/workspace_id/project_id/evidence_requirement_id/file_name
```

If an evidence requirement is not project-scoped, use `no-project` as the path segment.

## Database Records
The pilot stores file metadata in `attachments`:
- `organization_id`
- `workspace_id`
- `project_id`
- `storage_provider`
- `bucket`
- `storage_path`
- `file_name`
- `mime_type`
- `file_size_bytes`
- `is_private`
- `virus_scan_status`
- `metadata`

It links the attachment through `entity_attachments`:
- `entity_type = workflow_evidence_requirement`
- `entity_id = workflow_evidence_requirements.id`
- `attachment_id`
- `relationship_type = evidence`

It updates `workflow_evidence_requirements`:
- `status = uploaded`
- `attachment_id = attachments.id`

It also writes:
- `audit_events`
- `status_history` when status changes

## Allowed File Types
Pilot allowed types:
- PDF
- JPEG / PNG / WebP
- plain text
- CSV
- DOCX
- XLSX

Max pilot size: 10 MB.

## Security Limitations
This is not production-ready file management.

Not enabled yet:
- Production RLS policies
- Signed download URLs
- External malware scanning
- File retention automation
- File version review workflow
- Legal hold/archive rules
- External sharing controls

## Future RLS / Signed URL Requirements
Security scaffold update: `supabase/migrations/0004_rls_security_scaffold.sql`
defines helper functions and policy-family examples for evidence access, and
`docs/rls-storage-security-foundation.md` documents the staged rollout. These
policies are not production-enabled yet.

Before production use:
- Storage objects must inherit organization/workspace/project access.
- Attachment metadata must inherit access from the linked entity.
- Downloads should use short-lived signed URLs.
- Service-role access must remain server-only.
- External users require separate portal and file access review.

## Future Malware Scanning
The schema includes `virus_scan_status`, but no malware scanning service is integrated. Production upload should scan before evidence can be verified or included in closeout packages.

## Retention / Archive Strategy
Closeout and billing evidence should eventually support retention policies tied to contract obligations, warranty periods, lien periods, and customer requirements.

## Rollback / Fallback
Keep:

```text
RYBEXOS_EVIDENCE_STORE=local
```

Local/demo evidence actions remain available and do not require Supabase Storage.
