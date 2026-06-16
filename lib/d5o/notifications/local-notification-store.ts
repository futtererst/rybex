"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { NotificationStatus, OperatingNotification } from "./types";

type LocalNotificationUpdate = {
  notificationId: string;
  status: Extract<NotificationStatus, "acknowledged" | "in_progress" | "resolved" | "dismissed">;
  updatedAt: string;
};

type LocalNotificationState = {
  updatesByNotificationId: Record<string, LocalNotificationUpdate>;
};

const storageKey = "rybexos.notifications-demo-state.v1";
const emptyState: LocalNotificationState = { updatesByNotificationId: {} };
const listeners = new Set<() => void>();

export function useLocalNotificationStore() {
  const state = useSyncExternalStore(subscribe, readState, () => emptyState);

  const setNotificationStatus = useCallback((notification: OperatingNotification, status: LocalNotificationUpdate["status"]) => {
    const current = readState();
    const update = {
      notificationId: notification.id,
      status,
      updatedAt: new Date().toISOString()
    };

    writeState({
      updatesByNotificationId: {
        ...current.updatesByNotificationId,
        [notification.id]: update
      }
    });
  }, []);

  const resetNotificationState = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(storageKey);
      emit();
    }
  }, []);

  return {
    state,
    setNotificationStatus,
    resetNotificationState,
    applyNotificationOverlay(notification: OperatingNotification): OperatingNotification {
      const update = state.updatesByNotificationId[notification.id];

      if (!update) return notification;

      return {
        ...notification,
        status: update.status,
        acknowledgedAt: update.status === "acknowledged" ? update.updatedAt : notification.acknowledgedAt,
        resolvedAt: update.status === "resolved" || update.status === "dismissed" ? update.updatedAt : notification.resolvedAt,
        severity: update.status === "resolved" || update.status === "dismissed" ? "resolved" : notification.severity
      };
    }
  };
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit() {
  listeners.forEach((listener) => listener());
}

function readState(): LocalNotificationState {
  if (typeof window === "undefined") return emptyState;

  try {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) return emptyState;
    const parsed = JSON.parse(stored) as LocalNotificationState;
    return { updatesByNotificationId: parsed.updatesByNotificationId ?? {} };
  } catch {
    return emptyState;
  }
}

function writeState(state: LocalNotificationState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify(state));
  emit();
}
