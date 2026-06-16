import type { UserRole } from "./types";

export type AuditSeverity = "info" | "warning" | "critical";

export type AuditEvent = {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  actorRole: UserRole;
  actorName: string;
  timestamp: string;
  summary: string;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
  projectId?: string;
  severity?: AuditSeverity;
};

export const demoAuditEvents: AuditEvent[] = [
  createDemoAuditEvent({
    id: "audit-d2-approval-i77",
    entityType: "D5OGate",
    entityId: "gate-i77-define",
    action: "approved_d2_gate",
    actorRole: "operations_leader",
    actorName: "Alyssa Morgan",
    summary: "D2 contract baseline approved for I-77 Fiber Backbone Expansion - Phase 2.",
    projectId: "proj-i77-fiber",
    severity: "info"
  }),
  createDemoAuditEvent({
    id: "audit-daily-report-lake-norman",
    entityType: "DailyReport",
    entityId: "dr-lake-norman-bore-02",
    action: "flagged_change_prompt",
    actorRole: "field_supervisor",
    actorName: "Marcus Hill",
    summary: "Daily report flagged changed condition requiring RFI and change event review.",
    projectId: "proj-lake-norman-conduit",
    severity: "warning"
  }),
  createDemoAuditEvent({
    id: "audit-change-i77",
    entityType: "ChangeEvent",
    entityId: "chg-i77-extra-conduit",
    action: "pricing_submitted",
    actorRole: "project_manager",
    actorName: "Nora Patel",
    summary: "Pricing submitted for approved additional conduit footage.",
    projectId: "proj-i77-fiber",
    severity: "info"
  }),
  createDemoAuditEvent({
    id: "audit-safety-near-miss",
    entityType: "SafetyIncident",
    entityId: "incident-staging-backing",
    action: "root_cause_required",
    actorRole: "safety_manager",
    actorName: "Denise Carter",
    summary: "Near miss requires root-cause review and corrective action verification.",
    projectId: "proj-metro-broadband",
    severity: "critical"
  }),
  createDemoAuditEvent({
    id: "audit-closeout-clt",
    entityType: "CloseoutPackage",
    entityId: "co-clt-level-2",
    action: "submitted_for_acceptance",
    actorRole: "quality_manager",
    actorName: "Priya Shah",
    summary: "CLT Data Center closeout package submitted for GC acceptance.",
    projectId: "proj-clt-cabling",
    severity: "info"
  })
];

export function createDemoAuditEvent(event: Omit<AuditEvent, "timestamp"> & { timestamp?: string }): AuditEvent {
  return {
    timestamp: event.timestamp ?? "2026-06-10T09:00:00-04:00",
    ...event
  };
}

export function getAuditEventsForEntity(entityType: string, entityId: string) {
  return demoAuditEvents.filter((event) => event.entityType === entityType && event.entityId === entityId);
}
