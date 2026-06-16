import Link from "next/link";

export type MetricTone = "info" | "warning" | "critical" | "success" | "blocked" | "neutral";

type MetricCardProps = {
  label: string;
  value: string | number;
  helper: string;
  tone?: MetricTone;
  href?: string;
  ctaLabel?: string;
  compact?: boolean;
};

export function MetricCard({
  label,
  value,
  helper,
  tone = "info",
  href,
  ctaLabel,
  compact = false
}: MetricCardProps) {
  const content = (
    <>
      <span className="metric-label">{label}</span>
      <strong>{value}</strong>
      <span>{helper}</span>
      {href && ctaLabel ? <small className="metric-cta">{ctaLabel}</small> : null}
    </>
  );
  const className = `metric-card metric-${tone}${compact ? " metric-compact" : ""}`;

  if (href) {
    return (
      <Link className={className} href={href}>
        {content}
      </Link>
    );
  }

  return <div className={className}>{content}</div>;
}
