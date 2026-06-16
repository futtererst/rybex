import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const failures = [];

const types = source("lib/d5o/notifications/types.ts");
const config = source("lib/d5o/notifications/config.ts");
const derive = source("lib/d5o/notifications/derive-notifications.ts");
const localStore = source("lib/d5o/notifications/local-notification-store.ts");

const categories = [
  "decision_required",
  "gate_blocked",
  "evidence_missing",
  "evidence_overdue",
  "field_start_blocked",
  "daily_report_missing",
  "rfi_overdue",
  "submittal_overdue",
  "notice_deadline_risk",
  "change_backup_missing",
  "billing_backup_missing",
  "cash_at_risk",
  "safety_action_overdue",
  "quality_deficiency_overdue",
  "closeout_blocked",
  "retainage_blocked",
  "optimization_action_overdue",
  "system_readiness"
];
const severities = ["critical", "high", "watch", "info", "resolved"];
const statuses = ["new", "acknowledged", "in_progress", "escalated", "resolved", "dismissed"];
const roles = ["operations_leader", "project_manager", "field_supervisor", "finance_admin", "safety_manager", "quality_manager"];

for (const category of categories) {
  assertIncludes(types, `"${category}"`, `Notification category missing from types: ${category}`);
  assertIncludes(config, `${category}:`, `Notification category missing from config: ${category}`);
}

for (const severity of severities) {
  assertIncludes(types, `"${severity}"`, `Notification severity missing from types: ${severity}`);
  assertIncludes(config, `${severity}:`, `Notification severity missing from config: ${severity}`);
}

for (const status of statuses) {
  assertIncludes(types, `"${status}"`, `Notification status missing from types: ${status}`);
  assertIncludes(config, `${status}:`, `Notification status missing from labels: ${status}`);
}

for (const token of [
  "escalationRules",
  "RFI overdue by 1 day",
  "Change notice deadline within 24 hours",
  "Safety corrective action overdue",
  "Retainage release blocked"
]) {
  assertIncludes(config, token, `Escalation rule missing: ${token}`);
}

for (const token of [
  "deriveOperatingNotifications",
  "deriveOperatingWorkflows",
  "deriveEvidenceRequirements",
  "notificationsByRole",
  "criticalNotifications",
  "escalationQueue",
  "currentUserNotifications"
]) {
  assertIncludes(derive, token, `Notification derivation missing ${token}.`);
}

for (const role of roles) {
  assertIncludes(derive, `"${role}"`, `Role audience mapping missing ${role}.`);
}

for (const token of ["acknowledged", "in_progress", "resolved", "dismissed", "resetNotificationState"]) {
  assertIncludes(localStore, token, `Local notification action missing: ${token}`);
}

for (const component of [
  "NotificationBell",
  "NotificationPanel",
  "NotificationCard",
  "EscalationQueue",
  "NotificationSummaryStrip",
  "NotificationStatusChip"
]) {
  source(`components/d5o/notifications/${component}.tsx`);
}

if (failures.length > 0) {
  console.error("Notification verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Notification verification passed: categories, statuses, escalation rules, derivation, role audiences, local actions, and UI components are present.");

function source(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    failures.push(`Missing file: ${relativePath}`);
    return "";
  }
  return fs.readFileSync(absolutePath, "utf8");
}

function assertIncludes(text, token, message) {
  if (!text.includes(token)) failures.push(message);
}
