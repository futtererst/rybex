import type { EvidenceCategory, EvidenceStatus } from "./types";

export type EvidenceCategoryConfig = {
  label: string;
  shortLabel: string;
  purpose: string;
  typicalSourceModules: string[];
  requiredFor: string[];
  missingSeverity: "critical" | "high" | "watch" | "info";
  acceptedFileTypes: string[];
  helperText: string;
};

export const evidenceStatusLabels: Record<EvidenceStatus, string> = {
  missing: "Missing",
  pending: "Pending",
  uploaded: "Uploaded",
  under_review: "Under review",
  verified: "Verified",
  rejected: "Rejected",
  waived: "Waived",
  not_required: "Not required"
};

export const evidenceStatusTones: Record<EvidenceStatus, "critical" | "warning" | "success" | "info" | "neutral"> = {
  missing: "critical",
  pending: "warning",
  uploaded: "info",
  under_review: "warning",
  verified: "success",
  rejected: "critical",
  waived: "neutral",
  not_required: "neutral"
};

export const evidenceCategoryConfig: Record<EvidenceCategory, EvidenceCategoryConfig> = {
  photo: category("Photo evidence", "Photo", "Proves installed condition, damage, restoration, or field state.", ["field_execution", "quality", "safety"], ["D4", "D5", "billing"], "high", ["jpg", "png", "heic", "webp"]),
  daily_report: category("Daily report", "Report", "Captures production, labor, equipment, delays, and field prompts.", ["field_execution"], ["D4", "changes", "billing"], "critical", ["pdf", "docx"]),
  jha: category("JHA / JSA", "JHA", "Confirms work was planned safely before field execution.", ["safety", "mobilization"], ["D3", "D4"], "critical", ["pdf", "jpg", "png"]),
  safety_plan: category("Safety plan", "Safety", "Documents required safety readiness before field start.", ["safety", "mobilization"], ["D3", "D4"], "critical", ["pdf", "docx"]),
  utility_locate: category("Utility locate", "Locate", "Proves locate status before excavation or boring.", ["mobilization", "field_execution"], ["D3", "D4", "change_recovery"], "critical", ["pdf", "jpg", "png"]),
  rfi_attachment: category("RFI attachment", "RFI", "Supports a clarification request and response record.", ["rfis_submittals", "field_execution"], ["D4", "change_recovery"], "high", ["pdf", "jpg", "png", "docx"]),
  submittal_package: category("Submittal package", "Submittal", "Proves product/data approval and closeout traceability.", ["rfis_submittals", "closeout"], ["D3", "D5"], "high", ["pdf", "docx", "xlsx"]),
  change_backup: category("Change backup", "Backup", "Supports notice, pricing, entitlement, and billing recovery.", ["changes", "field_execution", "billing"], ["change_recovery", "billing"], "critical", ["pdf", "jpg", "png", "xlsx"]),
  tm_ticket: category("T&M ticket", "T&M", "Supports time-and-material recovery.", ["changes", "billing"], ["change_recovery", "billing"], "critical", ["pdf", "jpg", "png"]),
  pay_app_backup: category("Pay app backup", "Pay app", "Supports billed value and reduces rejection risk.", ["billing", "field_execution", "changes"], ["billing"], "critical", ["pdf", "xlsx", "jpg", "png"]),
  lien_waiver: category("Lien waiver", "Waiver", "Supports final payment and retainage release.", ["billing", "closeout"], ["billing", "D5"], "critical", ["pdf"]),
  inspection_record: category("Inspection record", "Inspect", "Proves work was inspected and accepted or corrected.", ["quality", "field_execution"], ["D4", "D5"], "high", ["pdf", "jpg", "png"]),
  test_result: category("Test result", "Test", "Proves required testing was completed and passed.", ["quality", "closeout"], ["D4", "D5"], "critical", ["pdf", "xlsx", "csv"]),
  otdr_result: category("OTDR result", "OTDR", "Proves fiber test acceptance for carrier closeout.", ["quality", "closeout"], ["D4", "D5"], "critical", ["pdf", "sor", "csv"]),
  punch_verification: category("Punch verification", "Punch", "Proves deficiency or punch correction was verified.", ["quality", "closeout"], ["D5"], "critical", ["pdf", "jpg", "png"]),
  as_built: category("As-built / redline", "As-built", "Proves final installed condition for acceptance and archive.", ["closeout", "field_execution"], ["D5"], "critical", ["pdf", "dwg", "jpg", "png"]),
  warranty: category("Warranty", "Warranty", "Supports closeout, retainage, and owner handoff.", ["closeout"], ["D5"], "high", ["pdf", "docx"]),
  om_document: category("O&M document", "O&M", "Supports owner handoff and archive completeness.", ["closeout"], ["D5"], "watch", ["pdf", "docx"]),
  closeout_package: category("Closeout package", "Closeout", "Assembles final acceptance and archive evidence.", ["closeout"], ["D5"], "critical", ["pdf", "zip"]),
  approval_record: category("Approval record", "Approval", "Proves decision rights and acceptance status.", ["pipeline", "projects", "mobilization", "closeout"], ["D1", "D2", "D3", "D5"], "high", ["pdf", "eml"]),
  other: category("Other evidence", "Other", "Supports an operating record where no standard category fits.", ["command_center"], ["workflow"], "watch", ["pdf", "jpg", "png", "docx", "xlsx"])
};

function category(
  label: string,
  shortLabel: string,
  purpose: string,
  typicalSourceModules: string[],
  requiredFor: string[],
  missingSeverity: EvidenceCategoryConfig["missingSeverity"],
  acceptedFileTypes: string[]
): EvidenceCategoryConfig {
  return {
    label,
    shortLabel,
    purpose,
    typicalSourceModules,
    requiredFor,
    missingSeverity,
    acceptedFileTypes,
    helperText: `${shortLabel} evidence must be visible before the related gate, recovery, billing, or closeout movement is trusted.`
  };
}
