# Evidence / Attachment Foundation

RybexOS now has a shared evidence layer for modeling, displaying, requiring, and locally verifying proof across the operating system.

## What Evidence Means

Evidence is the proof that lets a workflow move honestly:

- a gate can advance,
- a change can be recovered,
- a pay application can be supported,
- a safety or quality action can be verified,
- a closeout package can be accepted,
- an audit trail can explain why a decision was made.

The product standard is: if evidence is required, it should be visible, owned, due, and verifiable.

## Evidence Categories

The shared model covers:

- photos
- daily reports
- JHAs / JSAs
- safety plans
- utility locates
- RFI attachments
- submittal packages
- change backup
- T&M tickets
- pay application backup
- lien waivers
- inspection records
- test results
- OTDR results
- punch verification
- as-builts / redlines
- warranties
- O&M documents
- closeout packages
- approval records
- other supporting evidence

## What Was Implemented

- Evidence types: `lib/d5o/evidence/types.ts`
- Evidence category/status config: `lib/d5o/evidence/config.ts`
- Evidence derivation: `lib/d5o/evidence/derive-evidence.ts`
- Local demo evidence state: `lib/d5o/evidence/local-evidence-store.ts`
- Evidence UI components: `components/d5o/evidence/*`
- Evidence verification check: `npm run evidence:verify`
- Admin readiness section for evidence and attachment status

## Local / Demo Behavior

Users can locally mark evidence as:

- attached
- verified
- waived

This is browser-local demo state only. It does not upload files, write production attachment records, or change seed data.

## Not Production-Ready Yet

The foundation does not include:

- production file uploads
- Supabase Storage buckets
- signed upload URLs
- file preview/download security
- malware scanning
- file versioning
- active RLS/file policies
- permanent evidence writes for all modules

## Future Supabase Storage Plan

Pilot update: `docs/supabase-storage-evidence-pilot.md` defines a narrow
private Supabase Storage upload pilot for workflow evidence requirements. It is
opt-in with `RYBEXOS_EVIDENCE_STORE=database`; local/demo evidence actions remain
the default. The pilot can upload one file, write `attachments` metadata, link
through `entity_attachments`, and mark the evidence requirement uploaded. It is
not production document management.

Future production implementation should:

1. Store file metadata in `attachments`.
2. Store files in private Supabase Storage buckets.
3. Link files to records through `entity_attachments`.
4. Enforce organization, workspace, project, and record-level access.
5. Require audit events for upload, replace, waive, verify, and delete actions.
6. Support closeout package assembly without duplicating files.

## Security Considerations

- Never expose service-role keys to client components.
- Private object storage should be required for operational evidence.
- Finance, safety incident, and closeout evidence may need stricter access.
- Waivers and verification actions require audit events before production use.
- RLS/file access must be enabled before real external collaboration.

## Relationship to Operating Workflows

Evidence is used by:

- D2/D3 gate movement,
- D4 field proof,
- RFI and change recovery,
- billing backup,
- safety corrective action control,
- quality inspection/test verification,
- D5 closeout acceptance,
- Optimize lessons learned and improvement actions.

## Relationship to Notifications

Missing, overdue, rejected, or gate-critical evidence can now create in-app
notifications and escalation queue items. External notification delivery is not
enabled; alerts remain local/demo UI signals until production persistence,
auth/RLS, and delivery providers are approved.
