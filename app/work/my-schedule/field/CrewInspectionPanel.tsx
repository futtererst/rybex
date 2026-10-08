"use client";

import type { FormEvent } from "react";
import type { DeployCommand } from "@/lib/d5o/prototype-work/deploy-command";
import type { FieldInspection, FieldReport, DeployEvidence } from "@/components/d5o/platform/deploy-model";

type Action = Omit<DeployCommand, "workId" | "expectedRevision" | "commandId">;
const field = (data: FormData, name: string) => String(data.get(name) ?? "").trim();

export function CrewInspectionPanel({ reports, inspections, evidence, requirementIds, busy, onCommand }: { reports: FieldReport[]; inspections: FieldInspection[]; evidence: DeployEvidence[]; requirementIds: string[]; busy: boolean; onCommand: (action: Action) => Promise<boolean> }) {
  const reviewed = reports.filter((item) => item.status === "Reviewed");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await onCommand({ action: "record-inspection", reportId: field(data, "reportId"), requirementId: field(data, "requirementId") || undefined, requirement: field(data, "requirement"), method: field(data, "method"), result: field(data, "result") as "Pass" | "Fail", supersedesId: field(data, "supersedesId") || undefined, note: field(data, "note"), evidenceIds: data.getAll("evidenceId").map(String) });
  };
  return <section className="d5o-field-card"><h2>Inspect and retest</h2><p>Record the observed result against a reviewed report. Quality verifies it independently. A failed result remains open until a passing retest is verified.</p>{reviewed.length ? <form onSubmit={submit}><label>Reviewed work report<select name="reportId" required>{reviewed.map((item) => <option key={item.id} value={item.id}>{item.date} · revision {item.revision}</option>)}</select></label>{requirementIds.length ? <label>Released requirement<select name="requirementId" required><option value="">Choose requirement</option>{requirementIds.map((id) => <option key={id} value={id}>{id}</option>)}</select></label> : null}<label>Acceptance requirement<input name="requirement" required /></label><label>Test or inspection method<input name="method" required /></label><label>Observed result<select name="result"><option>Pass</option><option>Fail</option></select></label><label>Retest of<select name="supersedesId"><option value="">Initial result</option>{inspections.filter((item) => item.result === "Fail").map((item) => <option key={item.id} value={item.id}>{item.requirement} · {item.id.slice(0, 8)}</option>)}</select></label><label>Result note<textarea name="note" /></label><fieldset><legend>Supporting files</legend>{evidence.map((item) => <label key={item.id}><input type="checkbox" name="evidenceId" value={item.id} /> {item.filename} · {item.state}</label>)}</fieldset><button disabled={busy}>Submit result for quality review</button></form> : <p>A supervisor must review a submitted field report before its inspection can be recorded.</p>}{inspections.map((item) => <article key={item.id}><strong>{item.requirement} · {item.result} · {item.status}</strong><p>{item.method}{item.supersedesId ? ` · retest of ${item.supersedesId.slice(0, 8)}` : ""}</p>{item.reviewNote ? <small>Quality: {item.reviewNote}</small> : null}</article>)}</section>;
}
