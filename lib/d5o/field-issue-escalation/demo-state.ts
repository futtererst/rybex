import type { FieldIssueEscalation } from "./types";

export const canonicalFieldIssueId = "field-issue-lake-001";
export const canonicalFieldIssueDailyReportId = "dr-lake-bore-0610";
export const canonicalFieldIssueWorkPackageId = "wp-lake-bore-crew";
export const canonicalFieldIssueRfiId = "rfi-field-issue-lake-001";
export const canonicalFieldIssueChangeEventId = "chg-field-issue-lake-001";

export function createFieldIssueDemoState(): FieldIssueEscalation {
  return {
    id: canonicalFieldIssueId,
    projectId: "proj-lakeside-conduit",
    projectName: "Lake Norman Underground Conduit Package",
    dailyReportId: canonicalFieldIssueDailyReportId,
    workPackageId: canonicalFieldIssueWorkPackageId,
    workPackageName: "Hospital Access Road Bore Package",
    location: "Hospital access road and conduit crossing",
    summary: "Utility locates and traffic control release are not confirmed for the hospital access road bore path.",
    issueType: "utility_conflict",
    reportedBy: "Jon Reeves",
    reportedDate: "2026-06-10",
    owner: "Jon Reeves",
    severity: "critical",
    scheduleImpact: true,
    costExposure: 18500,
    evidenceRequirements: [
      {
        id: "field-daily-report-reference",
        label: "Daily report or field note",
        description: "Reference the field record proving the held-work condition.",
        status: "missing"
      },
      {
        id: "field-location-evidence",
        label: "Location/evidence reference",
        description: "Reference photos, locate ticket notes, or traffic-control comments.",
        status: "missing"
      }
    ],
    evidenceReferences: [],
    state: "unresolved",
    linkedDownstreamRecordIds: [],
    downstreamRecords: [],
    history: [],
    createdAt: "2026-06-10T08:00:00.000Z",
    updatedAt: "2026-06-10T08:00:00.000Z"
  };
}
