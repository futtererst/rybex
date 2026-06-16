import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const rbacSource = fs.readFileSync(path.join(root, "lib", "d5o", "rbac.ts"), "utf8");
const permissionSource = fs.readFileSync(path.join(root, "lib", "d5o", "auth", "workflow-transaction-permissions.ts"), "utf8");
const transactionSource = fs.readFileSync(path.join(root, "lib", "d5o", "workflow", "transactions.ts"), "utf8");

const transactionTypes = [
  "approve_go_no_go",
  "hold_go_no_go",
  "approve_d2_gate",
  "hold_d2_gate",
  "approve_d3_field_start",
  "hold_d3_field_start",
  "submit_daily_report",
  "create_rfi_from_signal",
  "create_change_event_from_signal",
  "resolve_workflow_action"
];

const mappedPermissions = [
  "approve_go_no_go",
  "edit_pipeline",
  "approve_d2_gate",
  "edit_project_setup",
  "approve_d3_gate",
  "edit_mobilization",
  "submit_daily_report",
  "approve_daily_report",
  "edit_rfis_submittals",
  "edit_changes",
  "edit_billing",
  "edit_safety",
  "edit_quality",
  "edit_closeout",
  "edit_lessons_learned",
  "manage_admin"
];

const failures = [];

for (const type of transactionTypes) {
  if (!transactionSource.includes(type)) {
    failures.push(`Missing workflow transaction type in transactions.ts: ${type}`);
  }

  if (!permissionSource.includes(type)) {
    failures.push(`Missing RBAC mapping for workflow transaction type: ${type}`);
  }
}

for (const permission of mappedPermissions) {
  if (!rbacSource.includes(`"${permission}"`)) {
    failures.push(`Mapped permission is not declared in RBAC config: ${permission}`);
  }
}

assertRolePermission("operations_leader", "approve_go_no_go", true);
assertRolePermission("operations_leader", "approve_d2_gate", true);
assertRolePermission("operations_leader", "approve_d3_gate", true);
assertRolePermission("operations_leader", "edit_changes", true);
assertRolePermission("operations_leader", "edit_rfis_submittals", true);
assertRolePermission("field_supervisor", "submit_daily_report", true);
assertRolePermission("estimator", "approve_d2_gate", false);
assertRolePermission("finance_admin", "edit_safety", false);

if (failures.length > 0) {
  console.error("RBAC verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("RBAC verification passed: transaction mappings, permission names, and allowed/denied role scenarios are consistent.");

function assertRolePermission(role, permission, expected) {
  const roleBlock = getRoleBlock(role);
  const actual = roleBlock.includes(`"${permission}"`);

  if (actual !== expected) {
    failures.push(
      `${role} ${expected ? "should have" : "should not have"} permission ${permission}.`
    );
  }
}

function getRoleBlock(role) {
  const pattern = new RegExp(`${role}: \\[([\\s\\S]*?)\\n\\s*\\]`, "m");
  const match = rbacSource.match(pattern);

  if (!match) {
    failures.push(`Role block not found: ${role}`);
    return "";
  }

  return match[1];
}
