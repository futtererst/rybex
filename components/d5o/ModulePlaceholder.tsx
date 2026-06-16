import Link from "next/link";
import { d5oPhaseMap } from "@/lib/d5o/config";
import type { RybexModule } from "@/lib/d5o/modules";

type ModulePlaceholderProps = {
  module: RybexModule;
};

export function ModulePlaceholder({ module }: ModulePlaceholderProps) {
  return (
    <section className="placeholder-page">
      <div className="placeholder-header">
        <div>
          <p className="page-kicker">Future Operating Module</p>
          <h1>{module.label}</h1>
          <p>{module.purpose}</p>
        </div>
        <Link className="button button-primary" href="/command-center">
          Back to Command Center
        </Link>
      </div>

      <div className="placeholder-grid">
        <section className="panel">
          <p className="eyebrow">Related D5O Phases</p>
          <div className="phase-chip-row">
            {module.relatedPhases.map((phaseId) => (
              <span className="chip chip-info" key={phaseId}>
                {d5oPhaseMap[phaseId].label}
              </span>
            ))}
          </div>
        </section>

        <section className="panel">
          <p className="eyebrow">Coming Next</p>
          <h2>{module.comingNext}</h2>
          <p className="muted">
            This route is intentionally controlled so navigation never drops users
            into a broken page while the operating workflows are being built.
          </p>
        </section>
      </div>

      <section className="panel">
        <p className="eyebrow">Planned Capabilities</p>
        <ul className="capability-list">
          {module.plannedCapabilities.map((capability) => (
            <li key={capability}>{capability}</li>
          ))}
        </ul>
      </section>
    </section>
  );
}
