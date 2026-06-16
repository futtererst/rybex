import { PilotCompletionTimeline } from "@/components/d5o/pilot/PilotCompletionTimeline";
import { PilotModeGuardrails } from "@/components/d5o/pilot/PilotModeGuardrails";
import { PilotModeHeader } from "@/components/d5o/pilot/PilotModeHeader";
import { PilotProgressSummary } from "@/components/d5o/pilot/PilotProgressSummary";
import { getPilotGuardrails, getPilotModeStatus, getPilotWorkflows } from "@/lib/d5o/pilot/pilot-slice";

export const metadata = {
  title: "Pilot Mode | RybexOS"
};

export default function PilotModePage() {
  const status = getPilotModeStatus();
  const workflows = getPilotWorkflows();

  return (
    <main className="command-grid" data-qa="pilot-mode-page">
      <PilotModeHeader
        completionModeLabel={status.completionModeLabel}
        status={status.label}
      />
      <PilotProgressSummary completionModeLabel={status.completionModeLabel} />
      <PilotCompletionTimeline workflows={workflows} />
      <PilotModeGuardrails guardrails={getPilotGuardrails()} />
    </main>
  );
}
