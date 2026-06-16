# Pilot Manual Acceptance Checklist

Status: Controlled internal pilot candidate — not production ready.

Use this checklist after `npm run pilot:acceptance` and before any founder, executive, or internal pilot review.

## Pilot Mode

- [ ] `/pilot` loads without console errors.
- [ ] Exactly 3 workflows are visible.
- [ ] Pilot progress is visible.
- [ ] Guardrails are visible.
- [ ] `Reset Pilot Demo State` is visible in local/demo mode.
- [ ] The page clearly states controlled internal pilot candidate, not production ready.

## Billing Backup

- [ ] `Backup note` field is visible.
- [ ] `Evidence reference` field is visible.
- [ ] `Resolution note` field is visible.
- [ ] Saved values remain visible after save.
- [ ] Required buttons stay disabled until required fields are saved.
- [ ] `Mark backup attached` works.
- [ ] `Send to review` works.
- [ ] `Resolve billing blocker` works.
- [ ] Result banner is visible.
- [ ] `Return to Pilot Mode` works.
- [ ] Billing card updates to complete/resolved.

## Field Issue

- [ ] `Escalation note` is visible.
- [ ] `Recommended control path` is visible.
- [ ] RFI/change details are visible for the selected path.
- [ ] `Control reason` is visible.
- [ ] `Resolution note` is visible.
- [ ] Saved values remain visible after save.
- [ ] Linked output record appears after creating an RFI or change event.
- [ ] `Mark issue controlled` works.
- [ ] `Resolve field issue` works.
- [ ] Result banner is visible.
- [ ] `Return to Pilot Mode` works.
- [ ] Field card updates to complete/resolved.

## Closeout

- [ ] `Closeout evidence note` is visible.
- [ ] `Evidence reference` is visible.
- [ ] `Acceptance note` is visible.
- [ ] Saved values remain visible after save.
- [ ] Evidence, review, and resolution steps are gated correctly.
- [ ] `Mark closeout evidence attached` works.
- [ ] `Send closeout item to review` works.
- [ ] `Resolve closeout blocker` works.
- [ ] Result banner is visible.
- [ ] `Return to Pilot Mode` works.
- [ ] Closeout card updates to complete/resolved.

## Runtime

- [ ] No hydration mismatch warning.
- [ ] No script-tag warning.
- [ ] No duplicate React key warning.
- [ ] No `getSnapshot should be cached` warning.
- [ ] No maximum update depth warning.

## Acceptance Gate

- [ ] `npm run pilot:acceptance` passes.
- [ ] `npm run pilot:acceptance-verify` passes.
- [ ] `npm run pilot:acceptance-visual` passes when visual review is required.

