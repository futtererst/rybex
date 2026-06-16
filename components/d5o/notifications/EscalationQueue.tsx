import type { OperatingNotification } from "@/lib/d5o/notifications/types";
import { NotificationCard } from "./NotificationCard";

type EscalationQueueProps = {
  notifications: OperatingNotification[];
  title?: string;
  limit?: number;
};

export function EscalationQueue({ notifications, title = "Escalation queue", limit = 5 }: EscalationQueueProps) {
  const visible = notifications.slice(0, limit);

  return (
    <section className="panel escalation-queue">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Escalation Queue</p>
          <h2>{title}</h2>
        </div>
        <span className="muted">In-app only. No external delivery.</span>
      </div>
      {visible.length > 0 ? (
        <div className="notification-stack">
          {visible.map((notification) => (
            <NotificationCard compact key={notification.id} notification={notification} />
          ))}
        </div>
      ) : (
        <p className="muted">No escalations require attention.</p>
      )}
    </section>
  );
}
