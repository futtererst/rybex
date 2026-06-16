import type { ChangeEvent, DailyReport } from "./types";

const operatingDate = "2026-06-10";

export type ChangeControlSummary = {
  commercialControlScore: number;
  noticeDeadlineRisks: ChangeEvent[];
  missingBackupItems: ChangeEvent[];
  pricingRequiredItems: ChangeEvent[];
  approvalAgingItems: ChangeEvent[];
  unbilledApprovedValue: number;
  disputedValue: number;
  requiredActions: string[];
  nextActions: string[];
};

export function evaluateChangeControl({
  changeEvents,
  dailyReports = []
}: {
  changeEvents: ChangeEvent[];
  dailyReports?: DailyReport[];
}): ChangeControlSummary {
  const noticeDeadlineRisks = changeEvents.filter(
    (event) =>
      event.noticeRequired &&
      event.noticeStatus !== "submitted" &&
      event.noticeStatus !== "waived" &&
      daysUntil(event.noticeDeadline) <= 3
  );
  const missingBackupItems = changeEvents.filter((event) =>
    ["missing", "partial"].includes(event.backupStatus)
  );
  const pricingRequiredItems = changeEvents.filter((event) =>
    ["notice_required", "notice_submitted", "pricing_required"].includes(event.status) ||
    ["not_started", "backup_needed", "pricing_in_progress"].includes(event.pricingStatus)
  );
  const approvalAgingItems = changeEvents.filter((event) =>
    ["pricing_submitted", "under_review"].includes(event.status)
  );
  const unbilledApprovedValue = changeEvents
    .filter((event) => event.billingStatus === "approved_not_billed")
    .reduce((total, event) => total + event.approvedAmount, 0);
  const disputedValue = changeEvents.reduce(
    (total, event) => total + event.rejectedAmount + event.disputedAmount,
    0
  );
  const fieldPromptsNotConverted = dailyReports.filter(
    (report) => report.changeEventNeeded && report.changedConditions.length > 0
  ).filter((report) =>
    !changeEvents.some((event) => event.linkedDailyReportIds.includes(report.id))
  );

  const checks = [
    noticeDeadlineRisks.length === 0,
    missingBackupItems.length === 0,
    pricingRequiredItems.length === 0,
    approvalAgingItems.length === 0,
    unbilledApprovedValue === 0,
    disputedValue === 0,
    fieldPromptsNotConverted.length === 0
  ];

  return {
    commercialControlScore: Math.round((checks.filter(Boolean).length / checks.length) * 100),
    noticeDeadlineRisks,
    missingBackupItems,
    pricingRequiredItems,
    approvalAgingItems,
    unbilledApprovedValue,
    disputedValue,
    requiredActions: [
      ...noticeDeadlineRisks.map((event) => `Submit notice for ${event.changeNumber} before ${event.noticeDeadline}.`),
      ...missingBackupItems.map((event) => `Complete backup for ${event.changeNumber}.`),
      ...pricingRequiredItems.map((event) => `Advance pricing for ${event.changeNumber}.`),
      ...fieldPromptsNotConverted.map((report) => `Create change event from ${report.workPackageName} daily report.`)
    ],
    nextActions: changeEvents.map((event) => event.requiredAction).filter(Boolean)
  };
}

function daysUntil(date: string) {
  const now = new Date(`${operatingDate}T12:00:00`);
  const target = new Date(`${date}T12:00:00`);

  return Math.ceil((target.getTime() - now.getTime()) / 86400000);
}
