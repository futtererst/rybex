# Deployment Readiness

## Current Deployment Mode

RybexOS is ready for local and static-style demo verification in seed mode. It is
not yet a production database-backed system.

Default mode:

```env
RYBEXOS_DATA_SOURCE=seed
```

Supabase/Postgres is not required for the current demo.
Stripe is not part of RybexOS.

## Local Demo Mode

Run:

```powershell
npm install
npm run demo:check
npm run build
npm run dev
```

Open:

- `http://127.0.0.1:3000/command-center`
- `http://127.0.0.1:3000/admin`

## Build Verification

Required checks:

```powershell
npm run typecheck
npm run lint
npm run build
npm audit --omit=dev
npm run demo:check
```

Optional visual capture before demo:

```powershell
npx playwright install chromium
npm run dev
npm run visual:capture
```

Route smoke checks require a running local server:

```powershell
npm run smoke:routes
```

Or run the full automated verification:

```powershell
npm run verify
```

## Environment Variables

Seed mode does not require database variables.

`.env.example` documents future placeholders:

- `RYBEXOS_DATA_SOURCE=seed`
- `RYBEXOS_WORKFLOW_TRANSACTION_STORE=local`
- `NEXT_PUBLIC_SUPABASE_URL=`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=`
- `SUPABASE_SECRET_KEY=`
- `SUPABASE_SERVICE_ROLE_KEY=`

Never expose `SUPABASE_SECRET_KEY` or service-role keys in client code, logs,
screenshots, or shared demo packages. Do not add Stripe variables, scripts, docs,
or code.

## Database Mode Warning

Do not enable `RYBEXOS_DATA_SOURCE=database` for stakeholder demos. Database
mode is scaffolded for future persistence pilots only.

## Vercel Considerations

The current app can be built as a Next.js app without database variables. For a
demo deployment:

- Keep `RYBEXOS_DATA_SOURCE=seed`.
- Do not set Supabase secret keys unless a future reviewed backend implementation needs them.
- Do not add Stripe.
- Run `npm run build` before deployment.
- Use `/command-center` as the demo landing route.
- Use `/admin` to show readiness status.

## Rollback / Fallback

If deployment or a future database pilot fails:

1. Restore `RYBEXOS_DATA_SOURCE=seed`.
2. Remove database-only env vars from the demo environment if needed.
3. Run `npm run verify`.
4. Demo from `/command-center`.

## Pre-Demo Checklist

- `npm run demo:check` passes.
- `npm run build` passes.
- `/command-center` opens.
- `/admin` opens.
- Demo docs match the current route list.
- Browser visual QA limitation is understood.

## Pre-Deploy Checklist

- No `.env` or secrets are packaged.
- Seed mode is default.
- `npm audit --omit=dev` passes.
- `npm run verify` passes locally.
- Persistence remains scaffolded only.
- Stakeholders understand the demo uses realistic seed data.
