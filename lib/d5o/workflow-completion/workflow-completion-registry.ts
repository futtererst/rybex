import type { CompletionWorkflowDefinition, CompletionWorkflowId } from "./definition-types";
import type { WorkflowCompletionItem } from "./types";

const billingSeedItem: WorkflowCompletionItem = {
  id: "billing-billing-backup-cash-recovery",
  completionWorkflowId: "billing-backup-cash-recovery",
  workflowType: "billing_backup_blocker",
  completionCategory: "cash_recovery",
  title: "Add missing billing backup",
  sourceModule: "billing",
  sourceRecordType: "billing_backup_item",
  sourceRecordId: "bb-lake-001",
  projectId: "proj-lake-norman-conduit",
  projectName: "Lake Norman Fiber Make-Ready",
  payApplicationId: "pay-lake-003",
  payApplicationNumber: "Pay App 003",
  owner: "Billing / PM",
  dueDate: "2026-07-15",
  status: "waiting_on_evidence",
  resolutionState: "evidence_required",
  severity: "high",
  reason: "Pay App 003 is blocked because required backup documentation is missing or incomplete.",
  businessImpact: "The $84K cash recovery path cannot move to commercial review until the backup package is documented and referenced.",
  blocker: "Missing product approval / billing backup for Pay App 003.",
  blockedAmount: 84000,
  requiredEvidenceIds: ["billing-backup-bb-lake-001"],
  relatedNotificationIds: ["notification-evidence-billing-backup-bb-lake-001"],
  relatedLinks: [
    { label: "Open pay application", href: "/billing/pay-application/new" },
    { label: "Review change exposure", href: "/changes?focus=changes-commercial-recovery#focused-task" },
    { label: "Review field support", href: "/field-execution?focus=field-execution-field-issue#focused-task" }
  ],
  requiredPermissions: ["edit_billing", "review_billing_backup"],
  nextStep: "Document the backup support, reference evidence, and send the package to commercial review.",
  updatedAt: "2026-06-12T00:00:00.000Z"
};

const fieldIssueSeedItem: WorkflowCompletionItem = {
  id: "field-issue-escalation",
  completionWorkflowId: "field-issue-escalation",
  workflowType: "field_issue_escalation",
  completionCategory: "field_escalation",
  title: "Escalate field issue",
  sourceModule: "field_execution",
  sourceRecordType: "daily_report_field_issue",
  sourceRecordId: "field-issue-zone-b-routing",
  projectId: "proj-lake-norman-conduit",
  projectName: "Lake Norman Fiber Make-Ready",
  owner: "Field Supervisor / PM",
  dueDate: "2026-06-14",
  status: "open",
  resolutionState: "user_action_required",
  severity: "high",
  reason: "Unclear conduit routing discovered in Zone B.",
  businessImpact: "Crew productivity and schedule may be affected without owner direction.",
  blocker: "Zone B conduit route needs clarification or commercial protection.",
  requiredEvidenceIds: [],
  relatedNotificationIds: ["notification-field-issue-zone-b"],
  relatedLinks: [
    { label: "New RFI", href: "/rfis-submittals/rfi/new" },
    { label: "New change event", href: "/changes/new" },
    { label: "Open daily report", href: "/field-execution/daily-report/new" }
  ],
  sourceIssue: {
    title: "Unclear conduit routing discovered in Zone B",
    sourceDailyReport: "D4 daily report DR-0142",
    location: "Zone B conduit run",
    recommendedEscalationPath: "RFI if clarification is needed. Change event if scope, cost, or schedule impact exists.",
    relatedEvidence: ["Daily report note", "Zone B field photos", "Crew impact note"]
  },
  linkedOutputRecords: [],
  requiredPermissions: ["submit_daily_report", "edit_rfis_submittals", "edit_changes", "resolve_workflow_action"],
  nextStep: "Create an RFI, create a change event, or mark the issue controlled.",
  updatedAt: "2026-06-14T00:00:00.000Z"
};

const closeoutSeedItem: WorkflowCompletionItem = {
  id: "closeout-requirement-final-billing-release",
  completionWorkflowId: "closeout-requirement-final-billing-release",
  workflowType: "closeout_requirement_completion",
  completionCategory: "closeout_release",
  title: "Complete closeout requirement",
  sourceModule: "closeout",
  sourceRecordType: "closeout_requirement",
  sourceRecordId: "closeout-asbuilt-redline-package",
  projectId: "proj-lake-norman-conduit",
  projectName: "Lake Norman Fiber Make-Ready",
  owner: "Project Manager / Closeout Owner",
  dueDate: "2026-06-17",
  status: "waiting_on_evidence",
  resolutionState: "evidence_required",
  severity: "high",
  reason: "Missing as-built redline package for Fiber Backbone Segment A.",
  businessImpact: "Acceptance, final billing, and retainage release may be delayed until this requirement is satisfied.",
  blocker: "As-built redline package is missing from the closeout package.",
  requiredEvidenceIds: [
    "closeout-asbuilt-redline-package",
    "closeout-completion-verification",
    "closeout-client-acceptance-support"
  ],
  relatedNotificationIds: ["notification-closeout-asbuilt-redline-package"],
  relatedLinks: [
    { label: "New closeout package", href: "/closeout/package/new" },
    { label: "Review acceptance risks", href: "/closeout#acceptance-risks" },
    { label: "Review final billing", href: "/billing?focus=billing-billing-backup-cash-recovery#focused-task" }
  ],
  displayFacts: [
    { label: "Requirement", value: "As-built redline package" },
    { label: "Package", value: "Fiber Backbone Segment A closeout" },
    { label: "Final billing", value: "Blocked until requirement is satisfied" },
    { label: "Acceptance", value: "Needs closeout review" }
  ],
  linkedOutputRecords: [],
  requiredPermissions: ["edit_closeout", "edit_evidence", "waive_evidence_requirement", "resolve_workflow_action"],
  nextStep: "Attach evidence, waive with a reason, or send the closeout item to review.",
  updatedAt: "2026-06-14T00:00:00.000Z"
};

export const completionWorkflowRegistry: Record<CompletionWorkflowId, CompletionWorkflowDefinition> = {
  "billing-backup-cash-recovery": {
    id: "billing-backup-cash-recovery",
    title: "Billing Backup Blocker -> Pay Application Review Readiness",
    sourceModule: "billing",
    sourceRecordType: "billing_backup_item",
    sourceRecordId: "bb-lake-001",
    primaryUserRole: "Billing / Commercial user",
    businessPurpose: "Move Pay App 003 from blocked backup preparation to commercial review readiness.",
    outcomeDefinition: {
      businessProcess: {
        name: "Billing backup completion and pay application readiness",
        startingProblem: "Pay App 003 is blocked because required backup documentation is missing or incomplete.",
        businessOutcome: "Billing backup blocker resolved. Pay App 003 is ready for commercial review. The $84K cash recovery path is no longer blocked by missing backup for this item.",
        businessImpact: "The $84K cash recovery path is no longer blocked by missing backup for this item. Cash recovery still depends on later pay application review, approval, and payment.",
        nextBusinessStep: {
          label: "Open pay application review",
          description: "Review the Pay App 003 package with the backup support now captured.",
          href: "/billing#details-records",
          ctaLabel: "Open billing records"
        },
        historicalReferenceLabel: "Pay App 003 billing backup readiness record",
        requiredCapturedInputLabels: ["Backup note", "Evidence reference", "Resolution note"],
        evidenceReferenceLabels: ["Product approval backup", "Daily report reference", "Signed T&M / supervisor backup reference"],
        documentReferenceLabels: []
      },
      businessObject: {
        type: "pay_application_backup_item",
        id: "pay-lake-003-bb-lake-001",
        label: "Pay App 003 / billing backup package"
      }
    },
    startState: "waiting_on_evidence",
    terminalStates: ["resolved"],
    states: [
      { state: "waiting_on_evidence", label: "Blocked: backup needed", resolutionState: "evidence_required" },
      { state: "evidence_attached", label: "Backup documented", resolutionState: "review_required" },
      { state: "waived", label: "Evidence waived", resolutionState: "waived" },
      { state: "ready_for_review", label: "Ready for review", resolutionState: "review_required" },
      { state: "resolved", label: "Resolved", resolutionState: "complete", terminal: true }
    ],
    actions: [
      {
        actionType: "mark_evidence_attached",
        label: "Mark backup attached",
        description: "Record that Pay App 003 backup support is documented and referenced for review.",
        fromStates: ["waiting_on_evidence", "reopened"],
        toState: "evidence_attached",
        resolutionState: "review_required",
        nextStep: "Send the Pay App 003 backup package to commercial review.",
        requiredPermissions: ["edit_evidence", "review_billing_backup"],
        requiresEvidence: false,
        requiresReason: false,
        updatesEvidence: "uploaded",
        writesHistory: true,
        resultMessage: "Backup marked attached. Pay App 003 support is documented and referenced. Next: send the package to commercial review.",
        blockedMessage: "Save a backup note and evidence reference before marking the Pay App 003 backup package attached.",
        qaSelector: "mark-backup-attached"
      },
      {
        actionType: "waive_evidence",
        label: "Waive evidence",
        description: "Waive the required evidence with a reason.",
        fromStates: ["waiting_on_evidence", "evidence_attached"],
        toState: "waived",
        resolutionState: "waived",
        nextStep: "Send the waived requirement to review or resolve the blocker.",
        requiredPermissions: ["waive_evidence_requirement"],
        requiresEvidence: false,
        requiresReason: true,
        updatesEvidence: "waived",
        writesHistory: true,
        resultMessage: "Evidence requirement waived. Billing item is ready for review.",
        blockedMessage: "Add a waiver reason before waiving required evidence.",
        qaSelector: "waive-evidence"
      },
      {
        actionType: "send_to_review",
        label: "Send to review",
        description: "Hand off the Pay App 003 backup package to the Commercial reviewer / Operations leader.",
        fromStates: ["evidence_attached", "waived"],
        toState: "ready_for_review",
        resolutionState: "review_required",
        nextStep: "Clear the billing blocker after review readiness is acknowledged.",
        requiredPermissions: ["review_billing_backup"],
        requiresEvidence: false,
        requiresReason: false,
        writesHistory: true,
        resultMessage: "Billing backup is ready for review. Pay App 003 backup package is ready for Commercial review.",
        blockedMessage: "Document and reference the Pay App 003 backup package before sending it to review.",
        qaSelector: "send-to-review"
      },
      {
        actionType: "resolve_workflow_blocker",
        label: "Resolve billing blocker",
        description: "Clear the missing-backup blocker for Pay App 003 after the review handoff is ready.",
        fromStates: ["ready_for_review", "waived"],
        toState: "resolved",
        resolutionState: "complete",
        nextStep: "Open pay application review.",
        requiredPermissions: ["edit_billing", "resolve_workflow_action"],
        requiresEvidence: false,
        requiresReason: false,
        updatesEvidence: "verified",
        writesHistory: true,
        resultMessage: "Billing blocker resolved. Pay application is no longer blocked by this backup item. Billing backup blocker resolved. Pay App 003 is ready for commercial review. The $84K cash recovery path is no longer blocked by missing backup for this item.",
        blockedMessage: "Send the Pay App 003 backup package to commercial review before clearing this billing blocker.",
        qaSelector: "resolve-billing-blocker",
        primary: true
      },
      {
        actionType: "reopen_workflow_blocker",
        label: "Reopen",
        description: "Reopen the billing blocker for demo review.",
        fromStates: ["resolved", "ready_for_review", "waived"],
        toState: "waiting_on_evidence",
        resolutionState: "evidence_required",
        nextStep: "Document the backup support and evidence reference again.",
        requiredPermissions: ["edit_billing"],
        requiresEvidence: false,
        requiresReason: false,
        writesHistory: true,
        resultMessage: "Billing blocker reopened. Backup evidence is required again.",
        blockedMessage: "Billing blocker cannot be reopened from the current state.",
        qaSelector: "reopen-billing-blocker"
      }
    ],
    requiredEvidence: [
      {
        id: "billing-backup-bb-lake-001",
        label: "Product approval backup",
        statusLabel: "missing",
        required: true,
        qaSelector: "evidence-status"
      }
    ],
    linkedOutputTypes: [],
    permissionRequirements: [{ permissions: ["edit_billing", "review_billing_backup"], mode: "any" }],
    notificationBehavior: [
      {
        onAction: "resolve_workflow_blocker",
        message: "Billing blocker resolved.",
        futurePersistence: false
      }
    ],
    auditBehavior: [
      {
        writesHistory: true,
        auditLabel: "Billing backup completion history",
        futureDatabaseAudit: true
      }
    ],
    routeTarget: "/billing",
    focusKey: "billing-billing-backup-cash-recovery",
    qaSelectors: {
      focusedTaskPanel: "focused-task-panel",
      completionPanel: "workflow-completion-panel",
      state: "completion-state",
      resultBanner: "completion-result-banner",
      history: "workflow-completion-history"
    },
    qaContract: {
      workflowId: "billing-backup-cash-recovery",
      startRoute: "/billing?focus=billing-billing-backup-cash-recovery#focused-task",
      focusedTaskSelector: '[data-qa="focused-task-panel"]',
      completionPanelSelector: '[data-qa="workflow-completion-panel"]',
      orderedActionSelectors: [
        '[data-qa="mark-backup-attached"]',
        '[data-qa="send-to-review"]',
        '[data-qa="resolve-billing-blocker"]'
      ],
      expectedStatesAfterEachAction: ["evidence_attached", "ready_for_review", "resolved"],
      expectedResultBannerText: [
        "Backup marked attached",
        "Billing backup is ready for review",
        "Billing blocker resolved"
      ],
      expectedLinkedOutputBehavior: "none",
      expectedTerminalState: "resolved",
      localQaSupported: true,
      databaseQaSupported: true,
      databasePilotActionSelectors: [
        '[data-qa="mark-backup-attached"]',
        '[data-qa="send-to-review"]',
        '[data-qa="resolve-billing-blocker"]'
      ]
    },
    demoSeedData: {
      item: billingSeedItem,
      evidence: [
        {
          id: "billing-backup-bb-lake-001",
          label: "Product approval backup",
          statusLabel: "missing",
          required: true,
          qaSelector: "evidence-status"
        }
      ]
    }
  },
  "field-issue-escalation": {
    id: "field-issue-escalation",
    title: "Field Issue -> RFI / Change Escalation",
    sourceModule: "field_execution",
    sourceRecordType: "daily_report_field_issue",
    sourceRecordId: "field-issue-zone-b-routing",
    primaryUserRole: "Field Supervisor / Project Manager",
    businessPurpose: "Move an open field issue into RFI or change control.",
    outcomeDefinition: {
      businessProcess: {
        name: "Field issue control and escalation",
        startingProblem: "Field issue requires owner direction, information control, or commercial protection.",
        businessOutcome: "Field issue is controlled through linked RFI or change event.",
        businessImpact: "Issue is no longer unmanaged in the daily report and is now tracked through a control path.",
        nextBusinessStep: {
          label: "Monitor RFI/change response and update field execution plan",
          description: "Use the linked output to track owner direction or recovery protection.",
          href: "/field-execution#details-records",
          ctaLabel: "View linked output"
        },
        historicalReferenceLabel: "Field issue escalation record",
        requiredCapturedInputLabels: ["Escalation note", "Control path", "RFI/change details", "Control reason", "Resolution note"],
        evidenceReferenceLabels: [],
        documentReferenceLabels: ["RFI draft details", "Change event details"]
      },
      businessObject: {
        type: "daily_report_field_issue",
        id: "field-issue-zone-b-routing",
        label: "Field issue from daily execution"
      }
    },
    startState: "open",
    terminalStates: ["resolved"],
    states: [
      { state: "open", label: "Open", resolutionState: "user_action_required" },
      { state: "rfi_created", label: "RFI created", resolutionState: "review_required" },
      { state: "change_event_created", label: "Change event created", resolutionState: "review_required" },
      { state: "controlled", label: "Controlled", resolutionState: "review_required" },
      { state: "resolved", label: "Resolved", resolutionState: "complete", terminal: true }
    ],
    actions: [
      {
        actionType: "create_rfi_from_field_issue",
        label: "Create RFI from field issue",
        description: "Create a local/demo RFI draft from the field issue.",
        fromStates: ["open", "in_progress", "user_action_required", "rfi_required", "reopened"],
        toState: "rfi_created",
        resolutionState: "review_required",
        nextStep: "Mark the field issue controlled once the RFI draft is reviewed.",
        requiredPermissions: ["edit_rfis_submittals"],
        requiresEvidence: false,
        requiresReason: false,
        createsLinkedOutput: {
          id: "rfi-draft-zone-b-routing",
          type: "rfi",
          title: "RFI draft from field issue",
          status: "draft",
          sourceIssueId: "field-issue-zone-b-routing",
          href: "/rfis-submittals/rfi/new",
          summary: "Clarification request started from Zone B conduit routing issue."
        },
        writesHistory: true,
        resultMessage: "RFI draft created from field issue. Field issue is now under information control.",
        blockedMessage: "RFI draft cannot be created from the current state.",
        qaSelector: "create-rfi-from-field-issue"
      },
      {
        actionType: "create_change_event_from_field_issue",
        label: "Create change event from field issue",
        description: "Create a local/demo change event draft from the field issue.",
        fromStates: ["open", "in_progress", "user_action_required", "change_required", "reopened"],
        toState: "change_event_created",
        resolutionState: "review_required",
        nextStep: "Mark the field issue controlled once the change event path is confirmed.",
        requiredPermissions: ["edit_changes"],
        requiresEvidence: false,
        requiresReason: false,
        createsLinkedOutput: {
          id: "change-draft-zone-b-routing",
          type: "change_event",
          title: "Change event draft from field issue",
          status: "draft",
          sourceIssueId: "field-issue-zone-b-routing",
          href: "/changes/new",
          summary: "Recovery path started for Zone B conduit routing impact."
        },
        writesHistory: true,
        resultMessage: "Change event draft created from field issue. Recovery path started.",
        blockedMessage: "Change event draft cannot be created from the current state.",
        qaSelector: "create-change-from-field-issue"
      },
      {
        actionType: "mark_field_issue_controlled",
        label: "Mark issue controlled",
        description: "Mark the original field issue controlled.",
        fromStates: ["open", "rfi_created", "change_event_created"],
        toState: "controlled",
        resolutionState: "review_required",
        nextStep: "Resolve the field issue after the control path is confirmed.",
        requiredPermissions: ["resolve_workflow_action"],
        requiresEvidence: false,
        requiresReason: false,
        writesHistory: true,
        resultMessage: "Field issue marked controlled.",
        blockedMessage: "Create an RFI/change or add a control reason before control.",
        qaSelector: "mark-field-issue-controlled"
      },
      {
        actionType: "resolve_field_issue",
        label: "Resolve field issue",
        description: "Resolve the field issue in local/demo state.",
        fromStates: ["controlled"],
        toState: "resolved",
        resolutionState: "complete",
        nextStep: "Field issue is under control through the selected RFI/change path.",
        requiredPermissions: ["resolve_workflow_action"],
        requiresEvidence: false,
        requiresReason: false,
        writesHistory: true,
        resultMessage: "Field issue resolved.",
        blockedMessage: "Field issue must be controlled before final resolution.",
        qaSelector: "resolve-field-issue",
        primary: true
      },
      {
        actionType: "reopen_field_issue",
        label: "Reopen field issue",
        description: "Reopen the field issue for demo review.",
        fromStates: ["resolved", "controlled"],
        toState: "open",
        resolutionState: "user_action_required",
        nextStep: "Create an RFI, create a change event, or mark the issue controlled.",
        requiredPermissions: ["resolve_workflow_action"],
        requiresEvidence: false,
        requiresReason: false,
        writesHistory: true,
        resultMessage: "Field issue reopened.",
        blockedMessage: "Field issue cannot be reopened from the current state.",
        qaSelector: "reopen-field-issue"
      }
    ],
    requiredEvidence: [],
    linkedOutputTypes: ["rfi", "change_event"],
    permissionRequirements: [{ permissions: ["submit_daily_report", "edit_rfis_submittals", "edit_changes", "resolve_workflow_action"], mode: "any" }],
    notificationBehavior: [
      {
        onAction: "create_rfi_from_field_issue",
        message: "Field issue is now under information control.",
        futurePersistence: false
      },
      {
        onAction: "create_change_event_from_field_issue",
        message: "Field issue recovery path started.",
        futurePersistence: false
      }
    ],
    auditBehavior: [
      {
        writesHistory: true,
        auditLabel: "Field issue completion history",
        futureDatabaseAudit: true
      }
    ],
    routeTarget: "/field-execution",
    focusKey: "field-issue-escalation",
    qaSelectors: {
      focusedTaskPanel: "focused-task-panel",
      completionPanel: "field-issue-completion-panel",
      state: "field-issue-state",
      resultBanner: "field-issue-result-banner",
      history: "workflow-completion-history",
      linkedOutput: "linked-output-record"
    },
    qaContract: {
      workflowId: "field-issue-escalation",
      startRoute: "/field-execution?focus=field-issue-escalation#focused-task",
      focusedTaskSelector: '[data-qa="focused-task-panel"]',
      completionPanelSelector: '[data-qa="field-issue-completion-panel"]',
      orderedActionSelectors: [
        '[data-qa="create-rfi-from-field-issue"]',
        '[data-qa="mark-field-issue-controlled"]',
        '[data-qa="resolve-field-issue"]'
      ],
      expectedStatesAfterEachAction: ["rfi_created", "controlled", "resolved"],
      expectedResultBannerText: [
        "RFI draft created from field issue",
        "Field issue marked controlled",
        "Field issue resolved"
      ],
      expectedLinkedOutputBehavior: "rfi",
      expectedTerminalState: "resolved",
      localQaSupported: true,
      databaseQaSupported: true,
      databasePilotActionSelectors: [
        '[data-qa="create-rfi-from-field-issue"]',
        '[data-qa="mark-field-issue-controlled"]',
        '[data-qa="resolve-field-issue"]'
      ]
    },
    demoSeedData: {
      item: fieldIssueSeedItem,
      evidence: []
    }
  },
  "closeout-requirement-final-billing-release": {
    id: "closeout-requirement-final-billing-release",
    title: "Closeout Requirement -> Acceptance / Final Billing Release",
    sourceModule: "closeout",
    sourceRecordType: "closeout_requirement",
    sourceRecordId: "closeout-asbuilt-redline-package",
    primaryUserRole: "Project Manager / Closeout Owner",
    businessPurpose: "Satisfy a closeout requirement so acceptance, final billing, and retainage release can move.",
    outcomeDefinition: {
      businessProcess: {
        name: "Closeout requirement completion and acceptance readiness",
        startingProblem: "Acceptance, final billing, or retainage release is blocked by a missing closeout requirement.",
        businessOutcome: "Closeout requirement resolved. Acceptance and final billing can proceed for this item.",
        businessImpact: "Closeout package and final billing readiness improved.",
        nextBusinessStep: {
          label: "Open closeout package review",
          description: "Review the closeout package item now that required evidence is captured.",
          href: "/closeout#details-records",
          ctaLabel: "Open closeout records"
        },
        historicalReferenceLabel: "Closeout completion record",
        requiredCapturedInputLabels: ["Closeout evidence note", "Evidence reference", "Acceptance note"],
        evidenceReferenceLabels: [],
        documentReferenceLabels: ["Closeout package section", "As-built redline package", "Acceptance support"]
      },
      businessObject: {
        type: "closeout_requirement",
        id: "closeout-asbuilt-redline-package",
        label: "Closeout requirement / closeout package item"
      }
    },
    startState: "waiting_on_evidence",
    terminalStates: ["resolved", "waived"],
    states: [
      { state: "waiting_on_evidence", label: "Waiting on evidence", resolutionState: "evidence_required" },
      { state: "evidence_attached", label: "Evidence attached", resolutionState: "review_required" },
      { state: "waived", label: "Waived", resolutionState: "waived", terminal: true },
      { state: "ready_for_review", label: "Ready for review", resolutionState: "review_required" },
      { state: "resolved", label: "Resolved", resolutionState: "complete", terminal: true },
      { state: "reopened", label: "Reopened", resolutionState: "evidence_required" }
    ],
    actions: [
      {
        actionType: "mark_closeout_evidence_attached",
        label: "Mark closeout evidence attached",
        description: "Mark the required closeout evidence as attached in local demo state.",
        fromStates: ["waiting_on_evidence", "reopened"],
        toState: "evidence_attached",
        resolutionState: "review_required",
        nextStep: "Send the closeout item to review.",
        requiredPermissions: ["edit_closeout", "edit_evidence"],
        requiresEvidence: false,
        requiresReason: false,
        updatesEvidence: "uploaded",
        writesHistory: true,
        resultMessage: "Closeout evidence marked attached. Next: send item to review.",
        blockedMessage: "Closeout evidence cannot be attached from the current state.",
        qaSelector: "mark-closeout-evidence-attached"
      },
      {
        actionType: "waive_closeout_requirement",
        label: "Waive closeout requirement",
        description: "Waive the closeout requirement with a reason.",
        fromStates: ["waiting_on_evidence", "evidence_attached", "reopened"],
        toState: "waived",
        resolutionState: "waived",
        nextStep: "Commercial risk is accepted for this closeout requirement.",
        requiredPermissions: ["waive_evidence_requirement"],
        requiresEvidence: false,
        requiresReason: true,
        updatesEvidence: "waived",
        writesHistory: true,
        resultMessage: "Closeout requirement waived with reason. Commercial risk accepted.",
        blockedMessage: "Add a waiver reason before waiving this closeout requirement.",
        qaSelector: "waive-closeout-requirement"
      },
      {
        actionType: "send_closeout_item_to_review",
        label: "Send closeout item to review",
        description: "Move the closeout item into review.",
        fromStates: ["evidence_attached", "waived"],
        toState: "ready_for_review",
        resolutionState: "review_required",
        nextStep: "Resolve the closeout blocker after review.",
        requiredPermissions: ["edit_closeout"],
        requiresEvidence: false,
        requiresReason: false,
        createsLinkedOutput: {
          id: "closeout-package-update-asbuilt-redline",
          type: "closeout_package_update",
          title: "Closeout package item ready for review",
          status: "ready_for_review",
          href: "/closeout/package/new",
          summary: "As-built redline package is ready for closeout review."
        },
        writesHistory: true,
        resultMessage: "Closeout item sent to review.",
        blockedMessage: "Attach or waive the closeout evidence before review.",
        qaSelector: "send-closeout-item-to-review"
      },
      {
        actionType: "resolve_closeout_blocker",
        label: "Resolve closeout blocker",
        description: "Resolve the closeout blocker in local demo state.",
        fromStates: ["ready_for_review", "waived"],
        toState: "resolved",
        resolutionState: "complete",
        nextStep: "Acceptance and final billing can proceed for this item.",
        requiredPermissions: ["edit_closeout", "resolve_workflow_action"],
        requiresEvidence: false,
        requiresReason: false,
        createsLinkedOutput: {
          id: "final-billing-release-note-asbuilt-redline",
          type: "final_billing_release_note",
          title: "Final billing release note",
          status: "ready",
          href: "/billing",
          summary: "Closeout blocker cleared for acceptance and final billing release."
        },
        updatesEvidence: "verified",
        writesHistory: true,
        resultMessage: "Closeout blocker resolved. Acceptance and final billing can proceed for this item.",
        blockedMessage: "Closeout item must be ready for review before resolving.",
        qaSelector: "resolve-closeout-blocker",
        primary: true
      },
      {
        actionType: "reopen_closeout_blocker",
        label: "Reopen closeout blocker",
        description: "Reopen the closeout blocker for demo review.",
        fromStates: ["resolved", "waived"],
        toState: "reopened",
        resolutionState: "evidence_required",
        nextStep: "Attach evidence, waive with a reason, or send the closeout item to review.",
        requiredPermissions: ["edit_closeout"],
        requiresEvidence: false,
        requiresReason: false,
        writesHistory: true,
        resultMessage: "Closeout blocker reopened.",
        blockedMessage: "Closeout blocker cannot be reopened from the current state.",
        qaSelector: "reopen-closeout-blocker"
      }
    ],
    requiredEvidence: [
      {
        id: "closeout-asbuilt-redline-package",
        label: "As-built redline package",
        statusLabel: "missing",
        required: true,
        qaSelector: "evidence-status"
      },
      {
        id: "closeout-completion-verification",
        label: "Test results or completion verification",
        statusLabel: "missing",
        required: true,
        qaSelector: "evidence-status"
      },
      {
        id: "closeout-client-acceptance-support",
        label: "Client acceptance support",
        statusLabel: "pending",
        required: false,
        qaSelector: "evidence-status"
      }
    ],
    linkedOutputTypes: [
      "closeout_package_update",
      "final_billing_release_note",
      "acceptance_readiness_update"
    ],
    permissionRequirements: [
      { permissions: ["edit_closeout", "edit_evidence", "waive_evidence_requirement", "resolve_workflow_action"], mode: "any" }
    ],
    notificationBehavior: [
      {
        onAction: "mark_closeout_evidence_attached",
        message: "Closeout evidence attached. Review required.",
        futurePersistence: false
      },
      {
        onAction: "send_closeout_item_to_review",
        message: "Closeout item is ready for review.",
        futurePersistence: false
      },
      {
        onAction: "resolve_closeout_blocker",
        message: "Closeout blocker resolved.",
        futurePersistence: false
      }
    ],
    auditBehavior: [
      {
        writesHistory: true,
        auditLabel: "Closeout requirement completion history",
        futureDatabaseAudit: true
      }
    ],
    routeTarget: "/closeout",
    focusKey: "closeout-requirement-final-billing-release",
    qaSelectors: {
      focusedTaskPanel: "focused-task-panel",
      completionPanel: "closeout-completion-panel",
      state: "closeout-state",
      resultBanner: "closeout-result-banner",
      history: "workflow-completion-history",
      linkedOutput: "closeout-linked-output-record"
    },
    qaContract: {
      workflowId: "closeout-requirement-final-billing-release",
      startRoute: "/closeout?focus=closeout-requirement-final-billing-release#focused-task",
      focusedTaskSelector: '[data-qa="focused-task-panel"]',
      completionPanelSelector: '[data-qa="closeout-completion-panel"]',
      orderedActionSelectors: [
        '[data-qa="mark-closeout-evidence-attached"]',
        '[data-qa="send-closeout-item-to-review"]',
        '[data-qa="resolve-closeout-blocker"]'
      ],
      expectedStatesAfterEachAction: ["evidence_attached", "ready_for_review", "resolved"],
      expectedResultBannerText: [
        "Closeout evidence marked attached",
        "Closeout item sent to review",
        "Closeout blocker resolved"
      ],
      expectedLinkedOutputBehavior: "final_billing_release_note",
      expectedTerminalState: "resolved",
      localQaSupported: true,
      databaseQaSupported: true,
      databasePilotActionSelectors: [
        '[data-qa="mark-closeout-evidence-attached"]',
        '[data-qa="send-closeout-item-to-review"]',
        '[data-qa="resolve-closeout-blocker"]'
      ]
    },
    demoSeedData: {
      item: closeoutSeedItem,
      evidence: [
        {
          id: "closeout-asbuilt-redline-package",
          label: "As-built redline package",
          statusLabel: "missing",
          required: true,
          qaSelector: "evidence-status"
        },
        {
          id: "closeout-completion-verification",
          label: "Test results or completion verification",
          statusLabel: "missing",
          required: true,
          qaSelector: "evidence-status"
        },
        {
          id: "closeout-client-acceptance-support",
          label: "Client acceptance support",
          statusLabel: "pending",
          required: false,
          qaSelector: "evidence-status"
        }
      ]
    }
  }
};

export function getCompletionWorkflowDefinition(id: CompletionWorkflowId) {
  return completionWorkflowRegistry[id];
}

export function getCompletionWorkflowDefinitionByFocusKey(focusKey: string) {
  return getRegisteredCompletionWorkflowDefinitions().find((definition) => definition.focusKey === focusKey);
}

export function getRegisteredCompletionWorkflowDefinitions() {
  return Object.values(completionWorkflowRegistry);
}

export function getCompletionDefinitionForItem(item: WorkflowCompletionItem) {
  return completionWorkflowRegistry[item.completionWorkflowId];
}

export function getCompletionDemoItems() {
  return getRegisteredCompletionWorkflowDefinitions().map((definition) => definition.demoSeedData.item);
}
