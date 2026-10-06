import { redirect } from "next/navigation";
import { D5OPlatform } from "@/components/d5o/platform/D5OPlatform";
import { getRequestContext } from "@/lib/d5o/auth/request-context";
import { assertProofEnvironment } from "@/lib/d5o/work-record/server";
import { crewPersonForUser, scheduleWorkspaceKeys } from "@/lib/d5o/scheduling/crew-identity";
import { loadConfigurationInventory } from "@/lib/d5o/configuration/server";
import "./enterprise.css";
import "./settings/notification-settings.css";

export const metadata = { title: "D5O Work" };

export default async function WorkHomePage() {
  assertProofEnvironment();
  const context = await getRequestContext();
  if (!context.authenticated) redirect("/auth/sign-in?next=%2Fwork");
  if (context.status !== "authorized" || !context.workspace) redirect("/auth/sign-in?next=%2Fwork");
  const initialWorkspace = scheduleWorkspaceKeys[context.workspace.id] ?? null;
  if (!initialWorkspace) redirect("/auth/sign-in?next=%2Fwork");
  if (context.user?.id && await crewPersonForUser(initialWorkspace, context.user.id)) redirect("/work/my-schedule");
  const configurationInventory = await loadConfigurationInventory(context.workspace.id);
  const actorLabel = context.role === "admin" ? `${context.profile?.displayName ?? "System Administrator"} · System Administrator` : undefined;
  return <D5OPlatform initialWorkspace={initialWorkspace} configurationInventory={configurationInventory} actorLabel={actorLabel} />;
}
