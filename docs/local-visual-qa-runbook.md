# Local Visual QA Runbook

The in-app browser connector is unreliable in the current Windows sandbox. Use
this local workflow to capture and review RybexOS screens without relying on
that connector.

## Automated Capture Path

This path uses Playwright as a dev-only visual QA dependency. It does not affect
product runtime, seed mode, database mode, auth, or deployment behavior.

1. Install dependencies:

   ```powershell
   npm install
   ```

2. Install the local Chromium browser binary once:

   ```powershell
   npx playwright install chromium
   ```

3. Run the normal confidence suite:

   ```powershell
   npm run verify
   ```

4. Start the app:

   ```powershell
   npm run dev
   ```

5. Open the Command Center manually:

   ```text
   http://127.0.0.1:3000/command-center
   ```

6. Capture screenshots:

   ```powershell
   npm run visual:capture
   ```

   Optional alternate target:

   ```powershell
   $env:BASE_URL="http://127.0.0.1:3000"; npm run visual:capture
   ```

7. Review output:

   - `visual-qa-output/desktop/`
   - `visual-qa-output/tablet/`
   - `visual-qa-output/mobile/`
   - `visual-qa-output/manifest.json`

8. Complete:

   - `docs/visual-qa-report-template.md`

## Manual Fallback

Use this if automated capture fails because browser tooling is unavailable on
the machine.

1. Run:

   ```powershell
   npm run verify
   npm run dev
   ```

2. Open:

   ```text
   http://127.0.0.1:3000/command-center
   ```

3. Capture screenshots manually for priority routes:

   - `/command-center`
   - `/pipeline`
   - `/projects`
   - `/mobilization`
   - `/field-execution`
   - `/field-execution/daily-report/new`
   - `/rfis-submittals`
   - `/changes`
   - `/billing`
   - `/safety`
   - `/quality`
   - `/closeout`
   - `/reports`
   - `/admin`

4. Save manual screenshots into:

   - `visual-qa-output/manual/`

5. Review desktop, tablet, and mobile widths manually.

6. Fill out:

   - `docs/visual-qa-report-template.md`

## What To Look For

- App shell and navigation remain stable.
- Page headers are consistent and executive-readable.
- Summary metric cards are readable and not cramped.
- Operating actions clearly state impact and next step.
- Guided workflows remain usable on mobile.
- No horizontal overflow appears on mobile/tablet.
- Command Center feels like the strongest first impression.

## Known Limitation

The current in-app browser connector may fail with:

```text
windows sandbox failed: spawn setup refresh
```

This is a tooling limitation, not an app failure. Use local browser/manual QA or
the Playwright capture path when available.
