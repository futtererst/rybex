import Link from "next/link";
import type { EndUserAction } from "@/lib/d5o/end-user/derive-primary-action";

type SecondaryActionListProps = {
  actions: EndUserAction[];
};

export function SecondaryActionList({ actions }: SecondaryActionListProps) {
  if (actions.length === 0) {
    return (
      <section className="end-user-secondary-actions">
        <p className="eyebrow">Also available</p>
        <p className="muted">No other urgent actions.</p>
      </section>
    );
  }

  return (
    <section className="end-user-secondary-actions">
      <p className="eyebrow">Also do</p>
      <div className="end-user-secondary-list">
        {actions.slice(0, 2).map((action) => (
          <article key={action.id}>
            <strong>{action.title}</strong>
            <span>{action.owner} · due {action.dueDate}</span>
            <Link href={action.href}>{action.ctaLabel}</Link>
          </article>
        ))}
      </div>
    </section>
  );
}
