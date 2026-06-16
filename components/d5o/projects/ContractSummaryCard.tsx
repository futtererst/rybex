import {
  contractStatusLabels,
  contractStatusTone
} from "@/lib/d5o/project-config";
import { chipClass } from "@/lib/d5o/presentation";
import type { RybexProject } from "@/lib/d5o/types";

export function ContractSummaryCard({ project }: { project: RybexProject }) {
  return (
    <article className="project-card">
      <div className="project-card-top">
        <div>
          <p className="eyebrow">Contract Baseline</p>
          <h3>{project.contractBaseline.summary}</h3>
        </div>
        <span className={chipClass(contractStatusTone[project.contractStatus])}>
          {contractStatusLabels[project.contractStatus]}
        </span>
      </div>
      <div className="detail-grid">
        <div className="detail">
          <span>Payment Terms</span>
          <strong>{project.paymentTerms.billingCycle || "Missing"}</strong>
        </div>
        <div className="detail">
          <span>Retainage</span>
          <strong>{project.retainagePercent}%</strong>
        </div>
        <div className="detail">
          <span>Notice Rules</span>
          <strong>{project.noticeRequirements.length} captured</strong>
        </div>
        <div className="detail">
          <span>Change Terms</span>
          <strong>{project.changeOrderTerms.length} captured</strong>
        </div>
      </div>
    </article>
  );
}
