"use client";

import type { EndUserWorkspaceSummary } from "@/lib/d5o/end-user/page-focus-config";
import { ActionCockpit } from "./ActionCockpit";
import { FocusedTaskPanel } from "./FocusedTaskPanel";

type ActionWorkspaceLayoutProps = {
  summary: EndUserWorkspaceSummary;
};

export function ActionWorkspaceLayout({ summary }: ActionWorkspaceLayoutProps) {
  return (
    <section className="end-user-workspace single-action-workspace" aria-label="Action workspace">
      <ActionCockpit summary={summary} />
      <FocusedTaskPanel summary={summary} />
    </section>
  );
}
