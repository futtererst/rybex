import type { DerivedNotificationSummary } from "@/lib/d5o/notifications/types";

type NotificationSummaryStripProps = {
  summary: DerivedNotificationSummary;
};

export function NotificationSummaryStrip({ summary }: NotificationSummaryStripProps) {
  return (
    <section className="notification-summary-strip">
      <div>
        <span>Critical</span>
        <strong>{summary.criticalNotifications.length}</strong>
      </div>
      <div>
        <span>Overdue</span>
        <strong>{summary.overdueNotifications.length}</strong>
      </div>
      <div>
        <span>Escalations</span>
        <strong>{summary.escalationQueue.length}</strong>
      </div>
      <div>
        <span>Your role</span>
        <strong>{summary.currentUserNotifications.length}</strong>
      </div>
    </section>
  );
}
