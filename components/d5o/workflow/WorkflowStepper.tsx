import type { WorkflowStage } from "@/lib/d5o/workflow";

const stages: Array<{ id: WorkflowStage; label: string }> = [
  { id: "signal", label: "Signal" },
  { id: "decision", label: "Decision" },
  { id: "action", label: "Action" },
  { id: "evidence", label: "Evidence" },
  { id: "gate_movement", label: "Gate Movement" }
];

export function WorkflowStepper({ activeStage = "action" }: { activeStage?: WorkflowStage }) {
  const activeIndex = stages.findIndex((stage) => stage.id === activeStage);

  return (
    <ol className="workflow-stepper" aria-label="Workflow operating sequence">
      {stages.map((stage, index) => (
        <li
          className={index <= activeIndex ? "workflow-step workflow-step-active" : "workflow-step"}
          key={stage.id}
        >
          {stage.label}
        </li>
      ))}
    </ol>
  );
}
