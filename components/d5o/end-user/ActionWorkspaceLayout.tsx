"use client";

import type { EndUserWorkspaceSummary } from "@/lib/d5o/end-user/page-focus-config";
import { ActionCockpit } from "./ActionCockpit";
import { FocusedTaskPanel } from "./FocusedTaskPanel";

type ActionWorkspaceLayoutProps = {
  summary: EndUserWorkspaceSummary;
  showFocusedTask?: boolean;
};

export function ActionWorkspaceLayout({ summary, showFocusedTask = true }: ActionWorkspaceLayoutProps) {
  return (
    <section className="end-user-workspace single-action-workspace" aria-label="Action workspace">
      <ActionCockpit summary={summary} />
      {showFocusedTask ? <FocusedTaskPanel summary={summary} /> : null}
    </section>
  );
}
