"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { focusTarget } from "@/components/d5o/focus-target";
import type { EndUserAction } from "@/lib/d5o/end-user/derive-primary-action";
import type { EndUserWorkspaceSummary } from "@/lib/d5o/end-user/page-focus-config";

type ActionCockpitProps = {
  summary: EndUserWorkspaceSummary;
};

const statusTone = {
  ready: "success",
  blocked: "critical",
  at_risk: "warning",
  complete: "success"
} as const;

const severityTone = {
  critical: "critical",
  high: "warning",
  watch: "info",
  info: "info",
  resolved: "success"
} as const;

function formatStatus(status: EndUserWorkspaceSummary["status"]) {
  return status.replace("_", " ");
}

function expandDetails() {
  focusTarget("details-records");
}

function pathFromHref(href: string) {
  if (!href.startsWith("/")) return "";
  return href.split(/[?#]/)[0] || "";
}

export function ActionCockpit({ summary }: ActionCockpitProps) {
  const pathname = usePathname();
  const action = summary.primaryAction;
  const blocker = summary.criticalBlockers[0];
  const evidenceItems = summary.evidenceNeededNow.slice(0, 3);
  const otherCriticalActions = summary.pageId === "command-center" ? summary.secondaryActions.slice(0, 2) : [];
  const dispatchTaskFocus = (focusedAction: EndUserAction) => {
    if (pathFromHref(focusedAction.href) !== pathname) return;

    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent("rybexos:task-focus", {
        detail: { focusId: focusedAction.taskOutcome.focusId }
      }));
    }, 80);
  };

  return (
    <article className={`action-cockpit action-cockpit-${severityTone[action.severity]}`}>
      <div className="action-cockpit-header">
        <div>
          <p className="eyebrow">{summary.d5oPhase}</p>
          <h2>{summary.stageLabel}</h2>
          <p>{summary.purpose}</p>
        </div>
        <span className={`chip chip-${statusTone[summary.status]}`}>
          {formatStatus(summary.status)}
        </span>
      </div>

      <div className="action-cockpit-main">
        <div>
          <div className="action-cockpit-kicker">
            <span>Do next</span>
            <span className={`chip chip-${severityTone[action.severity]}`}>{action.severity}</span>
          </div>
          <h3>{action.title}</h3>
          <p>{action.whyItMatters}</p>
        </div>
        <Link
          className="button button-primary action-cockpit-cta"
          href={action.href}
          onClick={() => dispatchTaskFocus(action)}
        >
          {action.ctaLabel}
        </Link>
      </div>

      <dl className="action-cockpit-meta">
        <div>
          <dt>Owner</dt>
          <dd>{action.owner}</dd>
        </div>
        <div>
          <dt>Due</dt>
          <dd>{action.dueDate}</dd>
        </div>
        <div>
          <dt>Blocked by</dt>
          <dd>{blocker ? blocker.title : summary.statusReason}</dd>
        </div>
      </dl>

      <div className="action-cockpit-support" aria-label="Action support">
        <div className="action-cockpit-row">
          <span>Evidence needed</span>
          <strong>
            {evidenceItems.length > 0
              ? evidenceItems.map((item) => item.title).join(" · ")
              : "None blocking"}
          </strong>
        </div>
        <div className="action-cockpit-row">
          <span>Why it matters</span>
          <strong>{action.taskOutcome.expectedOutcome}</strong>
        </div>
      </div>

      {otherCriticalActions.length > 0 ? (
        <div className="action-cockpit-secondary" aria-label="Other critical blockers">
          <span>Other critical blockers</span>
          {otherCriticalActions.map((secondaryAction) => (
            <Link
              href={secondaryAction.href}
              key={secondaryAction.id}
              onClick={() => dispatchTaskFocus(secondaryAction)}
            >
              {secondaryAction.ctaLabel}
            </Link>
          ))}
        </div>
      ) : null}

      <div className="action-cockpit-footer">
        <span>{summary.primaryUserIntent}</span>
        <a href="#details-records" onClick={expandDetails}>Open details</a>
      </div>
    </article>
  );
}
