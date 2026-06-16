# Expanded Details Visual QA

## Purpose

This QA mode captures the major desktop pages with every visible details drawer, collapsed section, and progressive disclosure section expanded.

These screenshots are for reviewer inspection of dense records and detail layouts. They do not represent the default end-user experience.

## Routes Captured

- `/command-center`
- `/pipeline`
- `/projects`
- `/mobilization`
- `/field-execution`
- `/rfis-submittals`
- `/changes`
- `/billing`
- `/safety`
- `/quality`
- `/closeout`
- `/reports`
- `/admin`

## Output Folder

Screenshots are saved to:

```text
visual-qa-output/expanded-details
```

Example files:

- `command-center-expanded.png`
- `billing-expanded.png`
- `reports-expanded.png`

## How To Run

Start the app:

```powershell
npm run dev
```

In another terminal, run:

```powershell
npm run visual:capture-expanded
npm run visual:verify-expanded
```

The capture uses the desktop visual QA viewport: 1440 by 1100, with full-page screenshots.

## What Reviewers Should Inspect

- Expanded detail content does not overflow or clip.
- Dense registers remain readable when opened.
- Tables and grids stay inside the page.
- Collapsed sections open without triggering workflow actions.
- Admin readiness content remains scannable when expanded.
- The default page experience remains action-first when details are not expanded.

## Safety Notes

The script avoids destructive and workflow-action buttons such as Confirm, Submit, Delete, Resolve, Approve, Hold, Waive, Verify, Upload, Dismiss, Acknowledge, and Mark in progress.

This mode intentionally expands dense content. Do not use these screenshots as the stakeholder default-view demo.
