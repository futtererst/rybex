import type { RybexPermission } from "../rbac";
import type { UserRole } from "../types";
import type { OperatingWorkflowType } from "../workflow/types";

export type NotificationSeverity = "critical" | "high" | "watch" | "info" | "resolved";

export type NotificationCategory =
  | "decision_required"
  | "gate_blocked"
  | "evidence_missing"
  | "evidence_overdue"
  | "field_start_blocked"
  | "daily_report_missing"
  | "rfi_overdue"
  | "submittal_overdue"
  | "notice_deadline_risk"
  | "change_backup_missing"
  | "billing_backup_missing"
  | "cash_at_risk"
  | "safety_action_overdue"
  | "quality_deficiency_overdue"
  | "closeout_blocked"
  | "retainage_blocked"
  | "optimization_action_overdue"
  | "system_readiness";

export type NotificationStatus = "new" | "acknowledged" | "in_progress" | "escalated" | "resolved" | "dismissed";

export type EscalationLevel = "none" | "owner" | "manager" | "leadership" | "executive";

export type NotificationDeliveryMode = "in_app" | "email_future" | "sms_future" | "teams_future" | "slack_future";

export type NotificationSource = {
  module: string;
  recordType: string;
  recordId: string;
  workflowType?: OperatingWorkflowType;
};

export type NotificationAudience = {
  roles: UserRole[];
  permissions?: RybexPermission[];
  deliveryModes: NotificationDeliveryMode[];
};

export type OperatingNotification = {
  id: string;
  category: NotificationCategory;
  severity: NotificationSeverity;
  status: NotificationStatus;
  title: string;
  summary: string;
  businessImpact: string;
  consequenceIfMissed: string;
  requiredAction: string;
  owner: string;
  ownerRole?: UserRole;
  audienceRoles: UserRole[];
  dueDate: string;
  escalationLevel: EscalationLevel;
  sourceModule: string;
  sourceRecordType: string;
  sourceRecordId: string;
  workflowInstanceId?: string;
  evidenceRequirementId?: string;
  projectId?: string;
  projectName?: string;
  targetHref: string;
  createdAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
};

export type EscalationRule = {
  id: string;
  category: NotificationCategory;
  trigger: string;
  severity: NotificationSeverity;
  audienceRoles: UserRole[];
  escalationLevel: EscalationLevel;
  targetModule: string;
  recommendedAction: string;
};

export type DerivedNotificationSummary = {
  allNotifications: OperatingNotification[];
  notificationsByRole: Record<UserRole, OperatingNotification[]>;
  criticalNotifications: OperatingNotification[];
  overdueNotifications: OperatingNotification[];
  escalationQueue: OperatingNotification[];
  commandCenterNotifications: OperatingNotification[];
  currentUserNotifications: OperatingNotification[];
};
