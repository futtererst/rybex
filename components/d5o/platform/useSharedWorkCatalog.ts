"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { WorkspaceKey } from "./schedule-model";
import type { CatalogMutation, CatalogWorkPackage, CatalogWorkRecord, SharedWorkCatalog } from "./work-catalog-model";
import type { WorkRecord } from "./work-types";

type Change = CatalogMutation extends infer T ? T extends { expectedRevision: number } ? Omit<T, "expectedRevision"> : never : never;

export function useSharedWorkCatalog(workspace: WorkspaceKey, hostedPreview = false) {
  const endpoint = hostedPreview
    ? `/api/d5o-hosted/prototype-catalog?workspace=${encodeURIComponent(workspace)}`
    : "/api/work/catalog";
  const [catalog, setCatalog] = useState<SharedWorkCatalog | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [error, setError] = useState("");
  const current = useRef<SharedWorkCatalog | null>(null);
  const pendingCreate = useRef<{ fingerprint: string; commandId: string } | null>(null);
  const refresh = useCallback(async () => {
    const response = await fetch(endpoint, { cache: "no-store" });
    if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? "Sign in to your authorized workspace to view shared work." : "Shared work is unavailable.");
    const payload = await response.json() as { catalog: SharedWorkCatalog; canEdit: boolean };
    if (payload.catalog.workspace !== workspace) throw new Error("Shared work workspace mismatch.");
    current.current = payload.catalog;
    setCatalog(payload.catalog);
    setCanEdit(payload.canEdit);
    setError("");
    return payload.catalog;
  }, [workspace, endpoint]);
  useEffect(() => {
    let active = true;
    const frame = requestAnimationFrame(() => refresh().catch((failure) => {
      if (active) setError(failure instanceof Error ? failure.message : "Shared work unavailable.");
    }));
    return () => { active = false; cancelAnimationFrame(frame); };
  }, [refresh]);
  const mutate = useCallback(async (change: Change): Promise<{ catalog: SharedWorkCatalog; created: CatalogWorkRecord | CatalogWorkPackage; workRevision?: number; workState?: { revision: number; records: WorkRecord[] } }> => {
    const state = current.current;
    if (!state) throw new Error("Load shared work before changing it.");
    const fingerprint = change.action === "create-record" || change.action === "create-package" ? JSON.stringify(change) : "";
    const commandId = change.action === "create-record" || change.action === "create-package"
      ? change.commandId ?? (pendingCreate.current?.fingerprint === fingerprint
        ? pendingCreate.current.commandId : crypto.randomUUID()) : undefined;
    if (commandId && (change.action === "create-record" || change.action === "create-package")) pendingCreate.current = { fingerprint, commandId };
    const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...change, commandId, expectedRevision: state.revision }) });
    const result = await response.json() as { catalog?: SharedWorkCatalog; created?: CatalogWorkRecord | CatalogWorkPackage; workRevision?: number; workState?: { revision: number; records: WorkRecord[] }; error?: string; message?: string };
    if (!response.ok || !result.catalog || !result.created) {
      if (response.status === 409) await refresh();
      const message = result.message ?? result.error ?? "Shared work change failed.";
      setError(message);
      throw new Error(message);
    }
    current.current = result.catalog;
    if (change.action === "create-record" || change.action === "create-package") pendingCreate.current = null;
    setCatalog(result.catalog);
    setError("");
    return { catalog: result.catalog, created: result.created, workRevision: result.workRevision, workState: result.workState };
  }, [refresh, endpoint]);
  return { catalog, canEdit, error, refresh, mutate };
}
