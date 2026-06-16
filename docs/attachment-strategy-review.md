# Attachment Strategy Review

Pilot update: a narrow Supabase Storage evidence upload pilot now exists for
`workflow_evidence_requirements`. It uses the private `rybexos-evidence` bucket
scaffold in `supabase/storage/rybexos-evidence-bucket.sql`, writes metadata to
`attachments`, links through `entity_attachments`, and updates evidence status to
`uploaded`. It remains opt-in and does not replace the local/demo evidence
fallback.

Security scaffold update: `docs/rls-storage-security-foundation.md` and
`supabase/migrations/0004_rls_security_scaffold.sql` now define the staged RLS
and Storage security model. Policies are scaffolded for review; production
enforcement is not enabled.

Update: RybexOS now includes an Evidence / Attachment Foundation. Evidence
requirements can be derived, displayed, and marked attached/verified/waived in
local demo state. Production upload, Supabase Storage, file access RLS, malware
scanning, and retention controls remain future work.

RybexOS needs private, auditable file evidence across the lifecycle. Recommended
initial approach: Supabase Storage or equivalent private object storage plus a
single `attachments` metadata table.

## Attachment Use Cases

- Bid docs, drawings, specs, addenda.
- Daily report photos and field evidence.
- Safety photos, incident attachments, JHA/toolbox evidence.
- Quality inspection photos, test records, punch evidence.
- RFI attachments and submittal packages.
- Change backup, directives, T&M tickets.
- Pay application backup and lien waivers.
- Closeout packages, as-builts, warranties, O&M documents.

## Metadata Table

Recommended `attachments` columns:

- `id`
- `organization_id`
- `project_id`
- `owner_entity_type`
- `owner_entity_id`
- `storage_provider`
- `bucket`
- `storage_path`
- `file_name`
- `mime_type`
- `file_size_bytes`
- `version`
- `checksum`
- `uploaded_by`
- `uploaded_at`
- `status`
- `is_private`
- `virus_scan_status`
- `retention_policy`

## Linking

- Use `owner_entity_type` and `owner_entity_id` for the primary owner.
- Use optional link table later if one file must support many records.
- Store references in audit events when attachments support approvals or disputes.

## Access Control

- Files are private by default.
- Storage paths should include organization and project IDs.
- Download URLs should be short-lived signed URLs.
- RLS on attachment metadata must mirror owner entity access.
- Finance, safety incident, and HR-sensitive attachments may need stricter policies.

## Versioning

- Version files by creating new attachment rows instead of overwriting.
- Preserve old versions for audit-sensitive records like contracts, pay apps, closeout packages, and warranties.

## File Safety

- Add allowed file type and size constraints before upload.
- Plan for virus/malware scanning status even if scanning is implemented later.
- Record checksum for evidence integrity.

## Review Result

The schema plan supports attachment metadata. Before implementation, add explicit
metadata columns for version, checksum, privacy, scan status, and storage provider.
