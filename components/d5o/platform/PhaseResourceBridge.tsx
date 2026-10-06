"use client";

type Phase = "Develop" | "Design" | "Deploy" | "Operate";

const guidance: Record<Phase, { title: string; description: string }> = {
  Develop: { title: "Test resource feasibility", description: "Use qualifications and capacity to test the proposed approach. Named bookings belong in Crew Schedule after Work Package demand is defined." },
  Design: { title: "Specify the crew requirement", description: "Set required dates, shifts, skills and crew size on each Work Package. People & capacity shows whether the resource model is plausible; Crew Schedule makes the booking." },
  Deploy: { title: "Staff and execute the released work", description: "Crew Schedule owns named bookings, conflicts, publication and worker responses. Return here for package execution, proof, quality and acceptance." },
  Operate: { title: "Cover ongoing obligations", description: "Check service qualifications and capacity for receiving obligations. A separate service visit or repeat job should be governed as related work." },
};

export function PhaseResourceBridge({ phase, demandCount, assignmentCount, onPeople, onCrew }: { phase: Phase; demandCount: number; assignmentCount: number; onPeople: () => void; onCrew: () => void }) {
  const copy = guidance[phase];
  return <section className="d5o-phase-resource-bridge" aria-label={`${phase} resource handoff`}><div><p>PEOPLE & SCHEDULING</p><h2>{copy.title}</h2><span>{copy.description}</span></div><div className="d5o-phase-resource-facts"><span><strong>{demandCount}</strong> package demand{demandCount === 1 ? "" : "s"}</span><span><strong>{assignmentCount}</strong> crew booking{assignmentCount === 1 ? "" : "s"}</span></div><div className="d5o-phase-resource-actions"><button type="button" onClick={onPeople}>View people & capacity →</button>{phase === "Deploy" ? <button type="button" onClick={onCrew}>Open Crew Schedule to book or move →</button> : null}</div></section>;
}
