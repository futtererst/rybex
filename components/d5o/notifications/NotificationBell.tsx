"use client";

import Link from "next/link";
import { useState } from "react";
import { useLocalNotificationStore } from "@/lib/d5o/notifications/local-notification-store";
import type { OperatingNotification } from "@/lib/d5o/notifications/types";
import { NotificationStatusChip } from "./NotificationStatusChip";

type NotificationBellProps = {
  notifications: OperatingNotification[];
};

export function NotificationBell({ notifications }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const { applyNotificationOverlay } = useLocalNotificationStore();
  const activeNotifications = notifications
    .map((item) => applyNotificationOverlay(item))
    .filter((item) => !["resolved", "dismissed"].includes(item.status));
  const urgentCount = activeNotifications.filter((item) => item.severity === "critical" || item.severity === "high").length;

  return (
    <div className="notification-bell">
      <button
        aria-expanded={open}
        className="notification-bell-button"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span>Alerts</span>
        <strong>{urgentCount}</strong>
      </button>
      {open ? (
        <div className="notification-popover">
          <div className="compact-heading">
            <h3>Top alerts</h3>
            <small className="muted">In-app only</small>
          </div>
          {activeNotifications.slice(0, 5).map((notification) => (
            <Link className="notification-popover-row" href={notification.targetHref} key={notification.id} onClick={() => setOpen(false)}>
              <div>
                <strong>{notification.title}</strong>
                <small>{notification.requiredAction}</small>
              </div>
              <NotificationStatusChip severity={notification.severity} status={notification.status} />
            </Link>
          ))}
          {activeNotifications.length === 0 ? <p className="muted">No active alerts.</p> : null}
          <Link className="button button-secondary" href="/command-center" onClick={() => setOpen(false)}>Open Command Center</Link>
        </div>
      ) : null}
    </div>
  );
}
