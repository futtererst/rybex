# Package Export Guide

## Safe Package Command

Create a shareable folder bundle:

```powershell
npm run demo:package
```

Output:

- `package-output/rybexos-demo-package`

This command creates a folder package, not a zip, so it does not require extra
dependencies.

## Exclude

Do not include:

- `node_modules`
- `.next`
- `visual-qa-output` unless screenshots are intentionally being shared
- `.env`
- `.env.local`
- Local secrets
- Supabase key values
- Stripe keys, docs, or scripts
- Temporary logs
- `package-output`
- `.git`

## Include

Include:

- `app`
- `components`
- `lib`
- `docs`
- `scripts`
- `supabase/migrations`
- `supabase/seed`
- `supabase/storage`
- `.env.example`
- `README.md`
- `package.json`
- `package-lock.json` if present
- `tsconfig.json`
- `eslint.config.mjs`
- `next.config.ts`

## Recipient Run Steps

From the package folder:

```powershell
npm install
npx playwright install chromium
npm run demo:check
npm run build
npm run dev
```

Open:

- `http://127.0.0.1:3000/command-center`
- `http://127.0.0.1:3000/admin`

## Manual Zip Guidance

If a zip is needed, zip the `package-output/rybexos-demo-package` folder after
running `npm run demo:package`.

Before sharing, confirm:

- No `.env` file is present.
- No service-role key is present.
- `node_modules` is not included.
- `.next` is not included.

## Sharing Screenshots

Automated or manual screenshots are written to `visual-qa-output/`. The standard
demo package excludes that folder to avoid accidentally sharing large temporary
capture files.

Playwright is dev-only and used for local visual QA. Browser binaries should be
installed by the recipient with `npx playwright install chromium`; they should
not be copied into the package manually.

If screenshots are needed for stakeholder review:

1. Run or collect screenshots into `visual-qa-output/`.
2. Review them and remove failed/duplicate captures.
3. Copy only the approved screenshots and `visual-qa-output/manifest.json` into a
   separate stakeholder review folder.
4. Do not include `.env`, secrets, `node_modules`, or `.next`.
