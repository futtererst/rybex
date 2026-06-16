import { StatusChip } from "@/components/d5o/StatusChip";
import { notificationSeverityTones, notificationStatusLabels } from "@/lib/d5o/notifications/config";
import type { NotificationSeverity, NotificationStatus } from "@/lib/d5o/notifications/types";

export function NotificationStatusChip({ severity, status }: { severity: NotificationSeverity; status: NotificationStatus }) {
  return (
    <StatusChip
      label={status === "new" ? severity : notificationStatusLabels[status]}
      tone={notificationSeverityTones[severity]}
    />
  );
}
