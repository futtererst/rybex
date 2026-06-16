import type { ReactNode } from "react";

type ProgressiveDetailsProps = {
  title: string;
  summary: string;
  count?: number;
  severity?: "critical" | "warning" | "info" | "success" | "neutral";
  children: ReactNode;
  defaultOpen?: boolean;
};

export function ProgressiveDetails({
  title,
  summary,
  count,
  severity = "neutral",
  children,
  defaultOpen = false
}: ProgressiveDetailsProps) {
  return (
    <details
      className={`progressive-details progressive-${severity}`}
      data-qa="progressive-details"
      open={defaultOpen}
    >
      <summary data-qa="details-toggle">
        <span>
          <strong>{title}</strong>
          <small>{summary}</small>
        </span>
        {typeof count === "number" ? <span className={`chip chip-${severity}`}>{count}</span> : null}
      </summary>
      <div className="progressive-details-body" data-qa="details-section">
        {children}
      </div>
    </details>
  );
}
