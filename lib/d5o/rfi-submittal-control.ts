import type { RFI, Submittal } from "./types";

const operatingDate = "2026-06-10";

export type RfiSubmittalControlSummary = {
  controlScore: number;
  overdueItems: Array<RFI | Submittal>;
  scheduleCriticalItems: RFI[];
  blockers: string[];
  warnings: string[];
  requiredActions: string[];
  nextActions: string[];
};

export function evaluateRfiSubmittalControl({
  rfis,
  submittals
}: {
  rfis: RFI[];
  submittals: Submittal[];
}): RfiSubmittalControlSummary {
  const overdueRfis = rfis.filter(
    (rfi) => rfi.status === "overdue" || isBefore(rfi.dueDate, operatingDate)
  );
  const overdueSubmittals = submittals.filter(
    (submittal) =>
      submittal.status === "overdue" ||
      isBefore(submittal.reviewDueDate, operatingDate) ||
      isBefore(submittal.requiredDate, operatingDate)
  );
  const scheduleCriticalItems = rfis.filter(
    (rfi) => rfi.scheduleImpact || rfi.priority === "critical"
  );
  const unassignedRfis = rfis.filter((rfi) => !rfi.assignedTo);
  const impactWithoutChange = rfis.filter(
    (rfi) => (rfi.costImpact || rfi.scheduleImpact) && rfi.linkedChangeEventIds.length === 0
  );
  const dueSoonSubmittals = submittals.filter(
    (submittal) => daysUntil(submittal.requiredDate) <= 7 && !["approved", "approved_as_noted", "closed"].includes(submittal.status)
  );
  const reviseRejected = submittals.filter((submittal) =>
    ["revise_and_resubmit", "rejected"].includes(submittal.status)
  );
  const blockingSubmittals = submittals.filter(
    (submittal) =>
      submittal.linkedWorkPackageIds.length > 0 &&
      !["approved", "approved_as_noted", "closed"].includes(submittal.status)
  );

  const blockers = [
    ...overdueRfis.map((rfi) => `RFI overdue: ${rfi.title}`),
    ...blockingSubmittals.map((submittal) => `Submittal blocking work: ${submittal.title}`),
    ...impactWithoutChange.map((rfi) => `Cost/schedule RFI lacks linked change event: ${rfi.title}`)
  ];
  const warnings = [
    ...unassignedRfis.map((rfi) => `RFI missing assignee: ${rfi.title}`),
    ...dueSoonSubmittals.map((submittal) => `Submittal due this week: ${submittal.title}`),
    ...reviseRejected.map((submittal) => `Submittal requires resubmission: ${submittal.title}`)
  ];

  const checks = [
    overdueRfis.length === 0,
    overdueSubmittals.length === 0,
    impactWithoutChange.length === 0,
    unassignedRfis.length === 0,
    blockingSubmittals.length === 0,
    reviseRejected.length === 0
  ];

  return {
    controlScore: Math.round((checks.filter(Boolean).length / checks.length) * 100),
    overdueItems: [...overdueRfis, ...overdueSubmittals],
    scheduleCriticalItems,
    blockers,
    warnings,
    requiredActions: blockers.map((blocker) => `Resolve ${blocker.toLowerCase()}.`),
    nextActions: [
      ...overdueRfis.map((rfi) => rfi.nextAction),
      ...dueSoonSubmittals.map((submittal) => submittal.nextAction),
      ...impactWithoutChange.map((rfi) => `Create or link a change event for ${rfi.rfiNumber}.`)
    ]
  };
}

function daysUntil(date: string) {
  const now = new Date(`${operatingDate}T12:00:00`);
  const target = new Date(`${date}T12:00:00`);

  return Math.ceil((target.getTime() - now.getTime()) / 86400000);
}

function isBefore(date: string | undefined, compareTo: string) {
  return Boolean(date && date < compareTo);
}
