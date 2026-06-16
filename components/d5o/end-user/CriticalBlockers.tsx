import Link from "next/link";
import type { EndUserBlocker } from "@/lib/d5o/end-user/derive-critical-blockers";

type CriticalBlockersProps = {
  blockers: EndUserBlocker[];
};

export function CriticalBlockers({ blockers }: CriticalBlockersProps) {
  return (
    <section className="end-user-panel">
      <div className="end-user-panel-heading">
        <p className="eyebrow">Blocked by</p>
        <span>{blockers.length > 0 ? `${blockers.length} visible` : "Clear"}</span>
      </div>
      {blockers.length > 0 ? (
        <div className="end-user-compact-list">
          {blockers.slice(0, 2).map((blocker) => (
            <article key={blocker.id}>
              <strong>{blocker.title}</strong>
              <p>{blocker.action}</p>
              <span>{blocker.owner} · due {blocker.dueDate}</span>
              <Link href={blocker.href}>Resolve</Link>
            </article>
          ))}
        </div>
      ) : (
        <p className="muted">No critical blocker is holding this workspace.</p>
      )}
    </section>
  );
}
