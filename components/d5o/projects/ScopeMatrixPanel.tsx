import { artifactLabels } from "@/lib/d5o/presentation";
import type { ScopeMatrixItem } from "@/lib/d5o/types";

export function ScopeMatrixPanel({ items }: { items: ScopeMatrixItem[] }) {
  if (items.length === 0) {
    return <p className="muted">No scope matrix items have been captured.</p>;
  }

  return (
    <section className="control-list">
      <h3>Scope Matrix</h3>
      <ul className="compact-list">
        {items.map((item) => (
          <li key={item.id}>
            <span className={`artifact-state artifact-${item.status}`} />
            <span>
              <strong>{item.description}</strong>
              <small className="muted">
                {item.category} | {artifactLabels[item.status]} | owner {item.owner}
              </small>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
