"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { EvidenceRequirement, EvidenceStatus } from "./types";

export type LocalEvidenceAction = "uploaded" | "verified" | "waived";

export type LocalEvidenceUpdate = {
  requirementId: string;
  status: Extract<EvidenceStatus, "uploaded" | "verified" | "waived">;
  note: string;
  actor: string;
  updatedAt: string;
};

export type LocalEvidenceState = {
  updatesByRequirementId: Record<string, LocalEvidenceUpdate>;
};

const storageKey = "rybexos.evidence-demo-state.v1";

const emptyState: LocalEvidenceState = {
  updatesByRequirementId: {}
};

const listeners = new Set<() => void>();

export function useLocalEvidenceStore() {
  const state = useSyncExternalStore(subscribe, readState, () => emptyState);

  const markEvidence = useCallback((requirement: EvidenceRequirement, action: LocalEvidenceAction, note: string) => {
    const update: LocalEvidenceUpdate = {
      requirementId: requirement.id,
      status: action,
      note,
      actor: "Demo user",
      updatedAt: new Date().toISOString()
    };
    const current = readState();

    writeState({
      updatesByRequirementId: {
        ...current.updatesByRequirementId,
        [requirement.id]: update
      }
    });

    return update;
  }, []);

  const resetEvidenceState = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(storageKey);
      emit();
    }
  }, []);

  return {
    state,
    markEvidence,
    resetEvidenceState,
    applyEvidenceOverlay(requirement: EvidenceRequirement) {
      const update = state.updatesByRequirementId[requirement.id];

      if (!update) {
        return requirement;
      }

      return {
        ...requirement,
        status: update.status,
        verificationStatus: update.status === "uploaded" ? "ready_for_review" : update.status,
        verifiedBy: update.status === "verified" || update.status === "waived" ? update.actor : requirement.verifiedBy,
        verifiedAt: update.status === "verified" || update.status === "waived" ? update.updatedAt : requirement.verifiedAt,
        nextAction: update.status === "uploaded"
          ? "Review uploaded demo evidence."
          : update.status === "verified"
            ? "Evidence verified in demo state."
            : "Evidence waived in demo state."
      } satisfies EvidenceRequirement;
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

function readState(): LocalEvidenceState {
  if (typeof window === "undefined") {
    return emptyState;
  }

  try {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) {
      return emptyState;
    }

    const parsed = JSON.parse(stored) as LocalEvidenceState;

    return {
      updatesByRequirementId: parsed.updatesByRequirementId ?? {}
    };
  } catch {
    return emptyState;
  }
}

function writeState(state: LocalEvidenceState) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(state));
  emit();
}
