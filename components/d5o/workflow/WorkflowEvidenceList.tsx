import type { WorkflowEvidence } from "@/lib/d5o/workflow";

export function WorkflowEvidenceList({ evidence }: { evidence: WorkflowEvidence }) {
  return (
    <div className="workflow-evidence">
      <strong>Evidence needed</strong>
      <ul>
        {evidence.required.slice(0, 5).map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      {evidence.currentState ? <p>{evidence.currentState}</p> : null}
    </div>
  );
}
