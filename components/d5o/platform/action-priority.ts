export type ActionImpact = "Critical" | "High" | "Standard";

export type ActionPriority = { nextActionDue?: string | null; nextActionImpact?: ActionImpact | null };

const impactOrder: Record<ActionImpact, number> = { Critical: 0, High: 1, Standard: 2 };

function validDue(value?: string | null): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value ? null : value;
}

/** A known earlier commitment wins; impact breaks same-day ties. Missing dates never imply urgency. */
export function compareActionPriority(left: ActionPriority, right: ActionPriority): number {
  const leftDue = validDue(left.nextActionDue);
  const rightDue = validDue(right.nextActionDue);
  if (leftDue && rightDue && leftDue !== rightDue) return leftDue.localeCompare(rightDue);
  if (leftDue !== rightDue) return leftDue ? -1 : 1;
  return (left.nextActionImpact ? impactOrder[left.nextActionImpact] : 3) - (right.nextActionImpact ? impactOrder[right.nextActionImpact] : 3);
}

export function actionDueLabel(due?: string | null): string {
  const value = validDue(due);
  if (!value) return "Due date not set";
  return `Due ${new Date(`${value}T12:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}`;
}

export function actionImpactLabel(impact?: ActionImpact | null): string {
  return impact ? `${impact} impact` : "Impact not set";
}
