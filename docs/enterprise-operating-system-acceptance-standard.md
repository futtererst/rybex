# RybexOS Enterprise Operating System Acceptance Standard

## 1. Purpose

RybexOS is not accepted as enterprise-grade because it has pages, workflows, dashboards, CTAs, data models, or QA scripts.

RybexOS is accepted as enterprise-grade only when it reliably helps a Rybex user execute a real subcontractor business process from start to finish, capture the required information and evidence, move a business object forward, create a referenceable historical record, and show the resulting business outcome.

The acceptance standard is:

**A user must understand what business process they are executing, why it matters, what they must provide, what changes when they act, who receives the handoff, what outcome was achieved, and where the record can be found later.**

---

## 2. Enterprise Operating System Definition

For RybexOS, an enterprise operating system is a role-based business execution layer that connects:

* opportunity qualification
* contract baseline
* mobilization readiness
* field execution
* RFIs/submittals
* change control
* billing and cash recovery
* safety
* quality
* closeout
* lessons learned
* historical records

It must not behave like a passive project dashboard. It must actively guide users through business processes that protect:

* margin
* cash flow
* schedule
* field productivity
* safety
* quality
* acceptance
* final billing
* retainage
* commercial recovery
* institutional memory

---

## 3. Core Acceptance Principle

Every workflow must satisfy this sentence:

**RybexOS guides the user through a business process, captures the required inputs and evidence, creates a historical record, and moves a real business object toward a measurable outcome.**

If a workflow does not satisfy this sentence, it is not accepted.

---

## 4. Acceptance Levels

### Level 0 — Not Accepted

The feature is only a page, dashboard, static panel, table, list, or placeholder.

Examples:

* CTA routes to a generic page.
* User sees information but cannot act.
* User can click buttons but no business state changes.
* Workflow says “resolved” but does not explain what business outcome occurred.
* Details exist but the user does not know what to do next.

### Level 1 — Mechanically Functional

The user can click through a sequence and state changes occur.

This is not enough for enterprise acceptance.

Minimum traits:

* buttons work
* fields save
* state changes
* QA passes

But the workflow may still fail if the user does not understand the business process.

### Level 2 — Human-Executable

The user can complete the workflow through visible controls without knowing the system architecture.

Minimum traits:

* guided steps are visible
* required fields are clear
* saved inputs remain visible
* disabled buttons explain what is missing
* result banner appears
* Pilot progress updates
* no hidden QA-only path is required

This is acceptable for controlled demo mechanics, but not full enterprise readiness.

### Level 3 — Business-Process Complete

The workflow explains the business problem, business object, process, handoff, outcome, evidence, and historical record.

Minimum traits:

* user understands why they are doing the workflow
* business object is explicit
* evidence/documents are captured or referenced
* business outcome is specific
* remaining blockers are shown
* next business step is clear
* historical record is created

This is the minimum acceptance level for RybexOS pilot workflows.

### Level 4 — Controlled Internal Pilot Ready

The workflow can be used by a limited internal Rybex user group under controlled conditions.

Minimum traits:

* Level 3 achieved
* acceptance QA passes
* manual acceptance passes
* known limitations documented
* local/demo vs database-backed behavior is clear
* no production readiness claim
* support/reset process exists
* data handling rules are understood

### Level 5 — Production Ready

The workflow is secure, persistent, role-controlled, auditable, operationally supported, and suitable for real production use.

Minimum traits:

* durable persistence
* production auth
* RLS/security enforced
* document storage secured
* audit logs durable
* role permissions enforced
* support process defined
* backups/recovery understood
* monitoring/logging in place
* production data governance in place

RybexOS is not currently at Level 5.

---

## 5. Workflow Acceptance Standard

Every RybexOS workflow must answer these questions before it is accepted.

| Acceptance Question                               | Required Standard                                                                                  |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| What business problem exists?                     | The workflow states the real-world issue in plain English.                                         |
| What business process is being executed?          | The process is named and understandable.                                                           |
| What business object is moving?                   | The app identifies the pay app, field issue, RFI, change event, closeout item, safety action, etc. |
| Why does it matter?                               | The app explains cash, schedule, safety, quality, client, or closeout impact.                      |
| Who owns it?                                      | Owner and role are visible.                                                                        |
| What must the user enter?                         | Required inputs are visible and explained.                                                         |
| What evidence or document is required?            | Required proof is identified, referenced, attached, or waived.                                     |
| What happens when the user saves?                 | The app shows what changed.                                                                        |
| What happens when the user advances the workflow? | State change and business meaning are visible.                                                     |
| Who receives the handoff?                         | Reviewer, queue, next owner, or next process is identified.                                        |
| What business outcome was achieved?               | Outcome is specific, not just “resolved.”                                                          |
| What remains unresolved?                          | Remaining blockers are shown or explicitly marked none.                                            |
| What is the next business step?                   | One clear next step is provided.                                                                   |
| Where can this be found later?                    | Historical record is visible/referenceable.                                                        |

---

## 6. Page Acceptance Standard

A RybexOS page is accepted only if a user can answer these within five seconds:

1. What page/process am I in?
2. What business object am I working on?
3. What is blocked, at risk, ready, or complete?
4. What do I need to do next?
5. What evidence or input is required?
6. What happens after I act?
7. Where do I go for details?

If a page primarily shows tables, panels, metrics, cards, or records without a clear business action path, it fails.

---

## 7. CTA Acceptance Standard

A CTA is accepted only if it creates a meaningful user outcome.

Accepted CTA outcomes:

* opens the exact task
* opens a guided workflow step
* saves user input
* advances workflow state
* creates or references a linked output
* opens a relevant record
* focuses the exact business object
* shows a clear unavailable/demo message
* returns the user to the next logical business step

Rejected CTA outcomes:

* routes to a generic module page
* highlights a generic details section
* reloads the same page
* opens a dense record area with no instruction
* says “Open priority” without naming the task
* says “Review details” without explaining what to review
* completes a step without explaining what changed

Every primary CTA must follow this contract:

**Click → exact task/object → visible instruction → user action → state change → business outcome or next step.**

---

## 8. Editable Field Acceptance Standard

Every required editable field must:

* be visible in the guided workflow
* have a plain-English label
* explain why the field matters
* accept user input
* save visibly
* show saved value after save
* appear in history or completion summary
* persist through route transitions in local/demo mode
* block downstream actions until completed if required
* show clear validation if missing

A workflow fails if the user is expected to move business state without entering or referencing the required information.

---

## 9. Evidence and Document Acceptance Standard

RybexOS must treat evidence and documents as part of the business process, not as optional attachments.

Every evidence-dependent workflow must show:

* what evidence is required
* why it is required
* whether it is missing, referenced, attached, verified, waived, or not required
* where it is referenced or stored
* what business process it blocks
* whether production upload is available or not
* waiver reason if evidence is skipped
* where the evidence reference appears in the historical record

A workflow cannot be accepted if evidence is mentioned but not captured, referenced, attached, or waived.

---

## 10. Business Outcome Acceptance Standard

A workflow is not accepted if its final outcome is only:

* resolved
* complete
* done
* closed

The final outcome must state:

* what business object moved
* what blocker was removed
* what business impact changed
* what evidence/input was captured
* what linked output was created
* whether anything remains open
* what the next business step is

Example accepted Billing outcome:

**Billing backup blocker resolved. Pay App 003 is ready for commercial review. The $84K cash recovery path is no longer blocked by missing product approval backup. Next step: open pay application review.**

---

## 11. Historical Record Acceptance Standard

Every completed workflow must create or simulate a historical record.

The record must include:

* workflow name
* business process
* business object
* owner
* user inputs
* evidence/document references
* linked outputs
* state changes
* outcome
* remaining blockers
* next business step
* local/demo or database-backed status
* timestamp/sequence where appropriate

A workflow fails if the user cannot answer:

**Where can I find what happened later?**

---

## 12. Pilot Mode Acceptance Standard

Pilot Mode is accepted only if a user can complete the controlled slice without understanding the entire RybexOS architecture.

Pilot Mode must show:

* exactly what workflows are included
* why each workflow matters
* workflow status
* current business object
* completion progress
* outcome after completion
* next business step
* local/demo vs database-backed caveat
* reset behavior

Current locked Pilot Mode workflows:

1. Billing Backup Blocker → Cash Recovery
2. Field Issue → RFI / Change Escalation
3. Closeout Requirement → Acceptance / Final Billing Release

Pilot Mode fails if:

* user gets lost after clicking a workflow
* progress does not update
* workflow completion feels like form completion without business meaning
* outcome records are unclear
* local/demo behavior is not labeled
* reset behavior is confusing

---

## 13. Runtime and Engineering Acceptance Standard

No workflow can be accepted if the runtime is unstable.

The app must not show:

* hydration mismatch
* script tag warning
* duplicate React key warning
* `getSnapshot should be cached`
* maximum update depth warning
* console errors during acceptance flow
* missing client handler binding
* route loops
* hidden QA-only controls

The accepted state architecture is:

**Server renders definitions/static shell. Client provider owns live workflow state. Persistence is adapter-driven. Pilot progress derives from the same client state.**

Forbidden patterns:

* DOM/script bridge for workflow execution
* localStorage reads during server render
* localStorage reads during initial client render that change markup
* random/time-based IDs in SSR-visible output
* generic route-only primary CTAs
* hidden controls required for workflow completion

---

## 14. QA Acceptance Standard

A workflow is not accepted because one QA script passes.

Acceptance requires layered proof:

### Automated proof

* runtime QA
* workflow execution QA
* user-flow QA
* CTA outcome QA
* task-outcome QA
* pilot acceptance QA
* visual capture
* build/type/lint/audit

### Manual proof

A human user must complete the workflow and confirm:

* business process is understandable
* inputs make sense
* buttons unlock logically
* state changes are obvious
* outcome is meaningful
* historical record is findable
* next step is clear

If manual review fails, automated QA is insufficient.

---

## 15. Business Process Design Standard

Before implementation, every workflow must have a blueprint.

The blueprint must include:

1. workflow name
2. business process
3. business object
4. starting problem
5. business impact
6. primary user
7. supporting users
8. reviewer/handoff owner
9. required stages
10. editable fields
11. evidence/documents
12. validation rules
13. handoff model
14. business outcome
15. historical record
16. remaining blockers
17. next business step
18. exact user-facing copy
19. non-goals
20. acceptance criteria

No workflow should be implemented without this blueprint.

---

## 16. Current RybexOS Acceptance Status

| Area                                 | Status                                                      |
| ------------------------------------ | ----------------------------------------------------------- |
| Operating model                      | Strong foundation                                           |
| Workflow mechanics                   | Strong                                                      |
| Pilot Mode                           | Built but still requires manual business-process validation |
| Editable fields                      | Built                                                       |
| State provider architecture          | Improved                                                    |
| Business outcome records             | Started                                                     |
| Historical records                   | Started                                                     |
| Business-process clarity             | Not yet accepted                                            |
| Production persistence               | Pilot/partial                                               |
| Production auth/RLS                  | Not ready                                                   |
| Production document storage/security | Not ready                                                   |
| External notifications               | Not ready                                                   |
| Enterprise-grade app quality         | Not yet accepted                                            |

Current classification:

**Controlled internal pilot candidate in development — not demo-ready, not production-ready, and not externally ready.**

---

## 17. Required Path to Enterprise Acceptance

### Step 1 — Freeze this standard

Save this as:

`docs/enterprise-operating-system-acceptance-standard.md`

### Step 2 — Apply it to Billing v2

Use the Billing v2 blueprint as the first gold-standard workflow.

### Step 3 — Implement Billing v2 only

Do not refactor Field or Closeout until Billing passes manually.

### Step 4 — Manual Billing acceptance

Validate that Billing v2 feels like a real business process.

### Step 5 — Apply the pattern to Field

Refactor Field Issue workflow using the accepted Billing v2 pattern.

### Step 6 — Apply the pattern to Closeout

Refactor Closeout workflow using the accepted Billing v2 pattern.

### Step 7 — Reassess Pilot Mode

Pilot Mode should be rebuilt around business outcomes, not completion mechanics.

### Step 8 — Only then prepare a demo package

No executive demo should be created until the pilot slice passes this standard.

---

## 18. Final Acceptance Statement

RybexOS reaches enterprise operating-system quality only when a real Rybex user can complete a business workflow and say:

“I understand the business problem, I know what record I changed, I entered the required information, I captured or referenced the necessary evidence, I know who receives it next, I can see the business outcome, I know what remains, and I can find the historical record later.”

Until then, the app is still a prototype with strong foundations, not an enterprise-grade operating system.
