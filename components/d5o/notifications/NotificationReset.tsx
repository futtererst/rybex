"use client";

import { useState } from "react";
import { useLocalNotificationStore } from "@/lib/d5o/notifications/local-notification-store";

export function NotificationReset() {
  const { resetNotificationState } = useLocalNotificationStore();
  const [message, setMessage] = useState("");

  return (
    <div className="button-row">
      <button
        className="button button-secondary"
        onClick={() => {
          resetNotificationState();
          setMessage("Demo notification state reset.");
        }}
        type="button"
      >
        Reset demo notification state
      </button>
      {message ? <span className="muted">{message}</span> : null}
    </div>
  );
}
