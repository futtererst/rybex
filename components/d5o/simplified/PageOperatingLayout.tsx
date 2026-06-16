import type { PageOperatingSummary } from "@/lib/d5o/simplification/page-summary";
import { ActiveRisksPanel } from "./ActiveRisksPanel";
import { EvidenceRequiredPanel } from "./EvidenceRequiredPanel";
import { GateReadinessPanel } from "./GateReadinessPanel";
import { ModuleStageHeader } from "./ModuleStageHeader";
import { NextActionPanel } from "./NextActionPanel";

type PageOperatingLayoutProps = {
  summary: PageOperatingSummary;
};

export function PageOperatingLayout({ summary }: PageOperatingLayoutProps) {
  return (
    <section className="page-operating-layout" aria-label="Page operating summary">
      <ModuleStageHeader
        d5oPhase={summary.d5oPhase}
        ownerRole={summary.ownerRole}
        purpose={summary.purpose}
        roleFocus={summary.roleFocus}
        stageLabel={summary.stageLabel}
        status={summary.status}
      />
      <div className="page-operating-grid">
        <NextActionPanel actions={summary.nextActions} />
        <GateReadinessPanel items={summary.readinessItems} />
        <EvidenceRequiredPanel evidenceItems={summary.evidenceItems} />
        <ActiveRisksPanel risks={summary.riskItems} />
      </div>
      <p className="details-route-note" id="details-records">
        Details available below: {summary.detailLabel}
      </p>
    </section>
  );
}
