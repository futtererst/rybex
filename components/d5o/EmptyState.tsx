import Link from "next/link";

type EmptyStateProps = {
  title: string;
  message: string;
  actionHref?: string;
  actionLabel?: string;
};

export function EmptyState({ title, message, actionHref, actionLabel }: EmptyStateProps) {
  return (
    <section className="state-panel state-empty">
      <p className="eyebrow">No Records</p>
      <h3>{title}</h3>
      <p>{message}</p>
      {actionHref && actionLabel ? (
        <Link className="button button-secondary" href={actionHref}>
          {actionLabel}
        </Link>
      ) : null}
    </section>
  );
}
