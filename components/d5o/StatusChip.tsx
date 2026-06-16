import type { MetricTone } from "./MetricCard";

type StatusChipProps = {
  label: string;
  tone?: MetricTone;
  title?: string;
};

export function StatusChip({ label, tone = "info", title }: StatusChipProps) {
  return (
    <span className={`chip chip-${tone}`} title={title}>
      {label}
    </span>
  );
}
