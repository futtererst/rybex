import type { WorkflowCompletionStatus } from "@/lib/d5o/workflow-completion/types";

type CompletionProgressStepperProps = {
  status: WorkflowCompletionStatus;
};

const steps = [
  { key: "waiting_on_evidence", label: "Evidence needed" },
  { key: "evidence_attached", label: "Attached / waived" },
  { key: "ready_for_review", label: "Ready for review" },
  { key: "resolved", label: "Resolved" }
] as const;

function stepState(step: (typeof steps)[number]["key"], status: WorkflowCompletionStatus) {
  if (["open", "in_progress", "user_action_required"].includes(status) && step === "waiting_on_evidence") return "active";
  if (["rfi_created", "change_event_created", "controlled"].includes(status) && step === "ready_for_review") return "active";
  if (["rfi_created", "change_event_created", "controlled"].includes(status) && ["waiting_on_evidence", "evidence_attached"].includes(step)) return "complete";
  if (status === "waived" && step === "evidence_attached") return "active";
  if (status === step) return "active";
  if (status === "resolved") return "complete";
  if (status === "ready_for_review" && ["waiting_on_evidence", "evidence_attached"].includes(step)) return "complete";
  if (status === "evidence_attached" && step === "waiting_on_evidence") return "complete";
  return "pending";
}

export function CompletionProgressStepper({ status }: CompletionProgressStepperProps) {
  return (
    <ol className="completion-stepper" aria-label="Completion progress">
      {steps.map((step) => (
        <li className={`completion-step completion-step-${stepState(step.key, status)}`} key={step.key}>
          <span aria-hidden="true" />
          <strong>{step.label}</strong>
        </li>
      ))}
    </ol>
  );
}
