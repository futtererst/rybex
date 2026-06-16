# RLS + Storage Security Foundation

## Security Goals
RybexOS must protect subcontractor operating data by organization, workspace,
project, role, and record ownership. This includes project status, commercial
exposure, safety/quality records, closeout evidence, workflow transactions,
audit history, and uploaded files.

## Current Non-Production Status
This pass creates a security foundation only.

Implemented:
- App-level RBAC for workflow transaction writes.
- App-level RBAC for the evidence upload pilot.
- RLS helper functions and policy-family scaffold.
- Private Supabase Storage bucket scaffold.
- Security readiness diagnostics.

Not production-ready:
- Supabase Auth login/session resolution.
- Broad RLS enforcement.
- Storage object policies.
- Signed URL download flow.
- Malware scanning.
- Production file retention/archive controls.

## Tenant Isolation Model
Primary isolation should be:

1. `organization_id`
2. `workspace_id`
3. `project_id`

Every operational record should be scoped to organization/workspace and, where
applicable, project.

## Organization / Workspace / Project Access
Future RLS should resolve the authenticated Supabase user to:

1. `user_profiles.auth_user_id = auth.uid()`
2. active `workspace_memberships`
3. role and permission set
4. project access through the record's `workspace_id` and `project_id`

Project access should generally require membership in the owning workspace.
Finance-sensitive, safety-sensitive, and admin-only actions require additional
role checks.

## Role / Permission Model
Application RBAC lives in:

- `lib/d5o/rbac.ts`
- `lib/d5o/auth/permission-guard.ts`

The RLS SQL scaffold includes `has_workspace_permission(workspace_uuid,
permission_key)` as a bridge function. It is intentionally coarse and should be
replaced with normalized role/permission tables before production.

## Auth User To User Profile Mapping
Future Supabase mode should map:

```text
auth.users.id -> user_profiles.auth_user_id -> workspace_memberships.user_profile_id
```

Demo auth mode remains default and does not require Supabase login.

## Workspace Membership Checks
The RLS scaffold adds:

- `auth_user_profile_id()`
- `auth_user_workspace_ids()`
- `auth_user_role_keys()`
- `is_workspace_member(workspace_uuid)`
- `has_workspace_permission(workspace_uuid, permission_key)`

These are in `supabase/migrations/0004_rls_security_scaffold.sql`.

## Project Access Assumptions
The scaffold adds:

- `can_access_project(project_uuid)`
- `can_access_workflow_instance(workflow_instance_uuid)`
- `can_access_evidence_requirement(evidence_requirement_uuid)`

These functions inherit workspace membership and project access.

## Service Role Boundaries
`SUPABASE_SECRET_KEY` / `SUPABASE_SERVICE_ROLE_KEY` must remain server-side.

Allowed server-only use:
- workflow transaction write pilot
- evidence upload pilot
- future migration/admin jobs

Not allowed:
- importing service keys in client components
- printing keys in logs
- packaging `.env.local`
- exposing keys in screenshots or docs

## Public Client Key Limitations
The publishable/anon key may support read-only pilot access, but it must not be
treated as authorization by itself. Production authorization requires Supabase
Auth, RLS, and table/storage policies.

## Evidence File Access Rules
Evidence files belong in a private bucket:

```text
rybexos-evidence
```

Metadata belongs in `attachments`. Record links belong in
`entity_attachments`. The linked entity controls access.

## Storage Path Convention

```text
organization_id/workspace_id/project_id/evidence_requirement_id/file_name
```

If no project exists, use `no-project`.

## Future Signed URL Strategy
Direct object reads should be avoided for production. Instead:

1. User requests a file preview/download.
2. Server resolves current user and permissions.
3. Server checks attachment and linked entity access.
4. Server creates a short-lived signed URL.
5. Audit event records the access when appropriate.

## Future Malware Scanning Strategy
Production upload must add scanning before evidence can be verified or used in
closeout/billing packages.

Suggested status flow:

```text
uploaded -> scan_pending -> scan_clean -> under_review -> verified
```

Rejected or infected files should be quarantined and excluded from gate movement.

## Known Limitations
- RLS policies are not broadly enabled.
- Storage policies are scaffolded as comments only.
- Supabase Auth session resolver is not active.
- File download/preview is not implemented.
- Malware scanning is not implemented.
- External user/GC portal access is not designed.
- Production monitoring and security incident response are pending.

## Rollout Sequence
1. Human review of this security foundation.
2. Apply `0004_rls_security_scaffold.sql` in an isolated Supabase environment.
3. Run `npm run db:inspect-security`.
4. Add Supabase Auth session resolution.
5. Replace coarse permission bridge with normalized role/permission data.
6. Enable RLS on one low-risk table and test.
7. Enable workflow/evidence tables after pilot write paths are verified.
8. Add private Storage policies.
9. Add signed URL download server action.
10. Add malware scanning and retention controls.

## Production Readiness Statement
RLS and Storage security are scaffolded, not production-ready. Do not claim
production security until Auth, RLS, Storage policies, signed URLs, monitoring,
backup, and incident response have been tested and approved.
