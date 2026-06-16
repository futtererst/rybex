import type { ArtifactStatus, ProjectHealthStatus } from "./types";

export const currency = new Intl.NumberFormat("en-US", {
  currency: "USD",
  maximumFractionDigits: 0,
  style: "currency"
});

export const compactCurrency = new Intl.NumberFormat("en-US", {
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
  style: "currency"
});

export const dateLabel = (value: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(`${value}T12:00:00`));

export const healthLabels: Record<ProjectHealthStatus, string> = {
  on_track: "On Track",
  watch: "Watch",
  at_risk: "At Risk",
  critical: "Critical",
  blocked: "Blocked",
  closed: "Closed"
};

export const healthTone: Record<ProjectHealthStatus, string> = {
  on_track: "success",
  watch: "warning",
  at_risk: "critical",
  critical: "critical",
  blocked: "blocked",
  closed: "neutral"
};

export const artifactLabels: Record<ArtifactStatus, string> = {
  complete: "Complete",
  missing: "Missing",
  pending: "Pending",
  waived: "Waived"
};

export const chipClass = (tone: string) => `chip chip-${tone}`;

export const severityTone = {
  low: "info",
  medium: "warning",
  high: "critical",
  critical: "critical"
} as const;
