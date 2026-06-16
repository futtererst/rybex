import Link from "next/link";

type PilotModeHeaderProps = {
  completionModeLabel: string;
  status: string;
};

export function PilotModeHeader({ completionModeLabel, status }: PilotModeHeaderProps) {
  return (
    <section className="panel pilot-mode-header" data-qa="pilot-mode-header">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Pilot Mode</p>
          <h1>Pilot Mode</h1>
          <p>Complete the three proven RybexOS operating workflows.</p>
        </div>
        <Link className="button button-secondary" href="/command-center">
          Command Center
        </Link>
      </div>
      <div className="operating-columns">
        <div className="control-list">
          <h3>Status</h3>
          <p>{status}</p>
        </div>
        <div className="control-list">
          <h3>Completion mode</h3>
          <p>{completionModeLabel}</p>
        </div>
        <div className="control-list">
          <h3>Included workflows</h3>
          <p>Billing backup, field issue escalation, and closeout requirement completion.</p>
        </div>
      </div>
    </section>
  );
}
