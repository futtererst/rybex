import { MetricCard, type MetricTone } from "./MetricCard";

type PipelineSummaryMetricProps = {
  label: string;
  value: string | number;
  detail: string;
  tone?: MetricTone;
  href?: string;
  ctaLabel?: string;
};

export function PipelineSummaryMetric({
  label,
  value,
  detail,
  tone = "info",
  href,
  ctaLabel
}: PipelineSummaryMetricProps) {
  return (
    <MetricCard ctaLabel={ctaLabel} helper={detail} href={href} label={label} tone={tone} value={value} />
  );
}
