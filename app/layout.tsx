import type { Metadata } from "next";
import Link from "next/link";
import { NotificationBell } from "@/components/d5o/notifications";
import { WorkflowCompletionProvider } from "@/components/d5o/workflow-completion/WorkflowCompletionProvider";
import { PrimaryNav, type PrimaryNavProps } from "@/components/layout/PrimaryNav";
import { getCurrentRybexUser } from "@/lib/d5o/auth/current-user";
import type { CanonicalWorkspaceRole } from "@/lib/d5o/auth/roles";
import { deriveOperatingNotifications } from "@/lib/d5o/notifications";
import { isProductionRuntime } from "@/lib/d5o/security/runtime-mode";
import { getRequestContext } from "@/lib/d5o/auth/request-context";
import { WorkspaceAppearance } from "@/components/layout/WorkspaceAppearance";
import { workspacePalette } from "@/components/layout/appearance";
import { prototypeWorkspaceLabel } from "@/lib/d5o/prototype/catalog";
import "./globals.css";

export const metadata: Metadata = {
  title: "D5O | System of work",
  description: "A configurable system of work for technical delivery and lifecycle services"
};

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  if (process.env.D5O_HOSTED_ENABLED === "1") {
    return (
      <html lang="en"><body className="d5o-auth-body">
        <WorkflowCompletionProvider>{children}</WorkflowCompletionProvider>
      </body></html>
    );
  }
  const productionMode = isProductionRuntime();
  const [currentUser, context] = await Promise.all([getCurrentRybexUser(), getRequestContext()]);
  const workspace = context.authenticated && context.status === "authorized" ? context.workspace : undefined;
  const proofReviewMode = process.env.M1_PROOF_ENABLED === "1" && process.env.RYBEXOS_RUNTIME_MODE === "test";
  const workspaceLabel = proofReviewMode && workspace ? prototypeWorkspaceLabel(workspace.id, workspace.name) : workspace?.name;
  const notificationSummary = workspace ? deriveOperatingNotifications() : undefined;
  const primaryNavProps = {
    productionMode,
    currentRole: currentUser.canonicalRole,
    currentRoleLabel: formatWorkspaceRole(currentUser.canonicalRole),
    currentUserName: currentUser.authenticated ? currentUser.name : undefined
  } satisfies PrimaryNavProps;

  if (proofReviewMode) {
    return (
      <html lang="en">
        <body className="d5o-auth-body">
          <WorkflowCompletionProvider>{children}</WorkflowCompletionProvider>
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <body>
        <WorkflowCompletionProvider>
          <WorkspaceAppearance key={`${context.user?.id ?? "guest"}:${workspace?.id ?? "none"}`} scope={`${context.user?.id ?? "guest"}:${workspace?.id ?? "none"}`} defaults={workspacePalette(workspace?.id)} workspaceName={workspaceLabel} variant={proofReviewMode ? "d5o-work" : "default"} sidebar={<>
              <Link className="brand" href={proofReviewMode ? "/work" : workspace ? "/command-center" : "/auth/sign-in"}>
                <span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 32 32" width="28" height="28" fill="none"><path d="M7 5h8a11 11 0 0 1 0 22H7V5Z" stroke="currentColor" strokeWidth="3"/><path d="M11 16h12m-4-4 4 4-4 4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
                <span>
                  <strong>D5O</strong>
                  <small>System of work</small>
                </span>
              </Link>
              {workspaceLabel ? <p className="active-workspace" aria-label="Active workspace">{workspaceLabel}</p> : null}
              {workspace ? <>
                {proofReviewMode ? <><p className="nav-group-label">Operate</p><Link className="nav-link nav-link-active" href="/work">Work</Link><Link className="nav-link" href="/work/my-work">My work</Link><Link className="nav-link" href="/work/portfolio">Portfolio</Link><Link className="nav-link" href="/work/start">Start work</Link><p className="nav-group-label">Current role</p><p className="demo-role-context"><span>{formatWorkspaceRole(currentUser.canonicalRole) ?? "Workspace member"}</span><strong>{currentUser.authenticated ? currentUser.name : "Signed in user"}</strong></p></> : <>
                  <NotificationBell notifications={notificationSummary!.commandCenterNotifications} />
                  <PrimaryNav {...primaryNavProps} />
                </>}
              </> : <p role="status">No active workspace. Sign in with an authorized workspace account.</p>}
            </>}>{children}</WorkspaceAppearance>
        </WorkflowCompletionProvider>
      </body>
    </html>
  );
}

function formatWorkspaceRole(role: CanonicalWorkspaceRole | undefined) {
  if (!role) return undefined;
  const labels: Record<CanonicalWorkspaceRole, string> = {
    executive: "Executive",
    operations_leader: "Operations Leader",
    business_development_lead: "Business Development Lead",
    project_manager: "Project Manager",
    billing_commercial_lead: "Billing / Commercial Lead",
    field_supervisor: "Field Supervisor",
    closeout_lead: "Closeout Lead",
    admin: "Administrator",
    read_only_auditor: "Auditor"
  };
  return labels[role];
}
