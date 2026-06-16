"use client";

import Link from "next/link";
import { dateLabel } from "@/lib/d5o/presentation";
import { useLocalNotificationStore } from "@/lib/d5o/notifications/local-notification-store";
import type { OperatingNotification } from "@/lib/d5o/notifications/types";
import { notificationCategoryLabels } from "@/lib/d5o/notifications/config";
import { NotificationStatusChip } from "./NotificationStatusChip";

type NotificationCardProps = {
  notification: OperatingNotification;
  compact?: boolean;
};

export function NotificationCard({ notification, compact = false }: NotificationCardProps) {
  const { applyNotificationOverlay, setNotificationStatus } = useLocalNotificationStore();
  const item = applyNotificationOverlay(notification);
  const resolved = item.status === "resolved" || item.status === "dismissed";

  return (
    <article className={`notification-card notification-${item.severity}${compact ? " notification-compact" : ""}`}>
      <div className="workflow-card-header">
        <div>
          <p className="eyebrow">{notificationCategoryLabels[item.category]}</p>
          <h3>{item.title}</h3>
        </div>
        <NotificationStatusChip severity={item.severity} status={item.status} />
      </div>
      <p>{item.requiredAction}</p>
      {!compact ? (
        <div className="workflow-card-grid">
          <div>
            <span className="workflow-label">Why</span>
            <strong>{item.businessImpact}</strong>
          </div>
          <div>
            <span className="workflow-label">If missed</span>
            <strong>{item.consequenceIfMissed}</strong>
          </div>
        </div>
      ) : null}
      <div className="workflow-meta-row">
        <span><strong>Owner</strong>{item.owner}</span>
        <span><strong>Due</strong>{dateLabel(item.dueDate)}</span>
        <span><strong>Escalation</strong>{item.escalationLevel}</span>
      </div>
      <div className="button-row">
        <Link className="button button-primary" href={item.targetHref}>Resolve</Link>
        {!resolved ? (
          <>
            <button className="button button-secondary" onClick={() => setNotificationStatus(item, "acknowledged")} type="button">Acknowledge</button>
            <button className="button button-secondary" onClick={() => setNotificationStatus(item, "in_progress")} type="button">In progress</button>
            <button className="button button-secondary" onClick={() => setNotificationStatus(item, "resolved")} type="button">Done</button>
          </>
        ) : null}
      </div>
      <small className="muted">In-app demo notification. External delivery is not enabled.</small>
    </article>
  );
}
