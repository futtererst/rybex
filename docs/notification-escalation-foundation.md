# Notification + Escalation Foundation

RybexOS now has a shared in-app notification and escalation layer.

## What Notifications Mean

Notifications are not generic activity updates. They exist to tell an owner:

- what requires attention,
- why it matters,
- who owns it,
- what action is required,
- when it is due,
- what happens if it is missed,
- where to resolve it.

## How Notifications Are Derived

Notifications are derived from:

- operating workflows,
- missing or overdue evidence,
- blocked gates,
- field-start blockers,
- daily report gaps,
- RFI/submittal aging,
- notice deadline risk,
- change backup gaps,
- billing backup and cash-at-risk signals,
- safety and quality overdue items,
- closeout/retainage blockers,
- Optimize improvement actions.

## Escalation Rules

Configured escalation rules cover:

- RFIs overdue by 1 day or 5 days,
- change notice deadlines inside 24 hours,
- D3 field starts blocked within 48 hours,
- missing daily reports after cutoff,
- billing backup missing inside a pay app cycle,
- approved changes not billed,
- safety corrective actions overdue,
- quality tests missing near closeout,
- closeout packages blocked past target date,
- retainage release blocked by missing waiver,
- lessons learned overdue after closeout.

## Local / Demo Behavior

Notifications are in-app only. Local demo users can:

- acknowledge,
- mark in progress,
- resolve,
- dismiss,
- reset demo notification state.

This uses browser-local state and does not persist notification records.

## What Is Not Production-Ready

The foundation does not include:

- email delivery,
- SMS delivery,
- push notifications,
- Teams or Slack integration,
- notification persistence,
- production user preferences,
- delivery logs,
- retry handling,
- escalation scheduling,
- RLS-backed notification access control.

## Future Delivery Plan

Production notification delivery should be added only after:

1. Auth and RLS are active.
2. Workflow/evidence persistence is durable.
3. User preferences and role ownership are persisted.
4. Audit events exist for notification creation, escalation, acknowledgement, and resolution.
5. Delivery providers are approved.

## Relationship to Workflow, Evidence, and RBAC

Notifications sit on top of the operating model:

**Signal -> Decision -> Action -> Evidence -> Gate Movement**

They turn workflow and evidence risk into a role-owned in-app action. RBAC should govern who can resolve the underlying workflow, even if many roles can see an alert.
