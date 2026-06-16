import type { EndUserEvidenceItem } from "@/lib/d5o/end-user/derive-evidence-needed-now";

type EvidenceNeededNowProps = {
  items: EndUserEvidenceItem[];
};

export function EvidenceNeededNow({ items }: EvidenceNeededNowProps) {
  return (
    <section className="end-user-panel">
      <div className="end-user-panel-heading">
        <p className="eyebrow">Needed now</p>
        <span>{items.length > 0 ? `${items.length} evidence item(s)` : "None missing"}</span>
      </div>
      {items.length > 0 ? (
        <ul className="end-user-evidence-list">
          {items.slice(0, 3).map((item) => (
            <li key={item.id}>
              <span className="artifact-state artifact-pending" />
              <span>
                <strong>{item.title}</strong>
                <small>{item.owner} · {item.dueDate ?? "due now"}</small>
              </span>
              <em>{item.blocks}</em>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No missing evidence blocks the next action.</p>
      )}
    </section>
  );
}
