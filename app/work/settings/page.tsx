import { redirect } from "next/navigation";
import { getRequestContext } from "@/lib/d5o/auth/request-context";
import { crewPersonForUser, scheduleWorkspaceKeys } from "@/lib/d5o/scheduling/crew-identity";

// Older settings bookmarks return to the user's workspace; preferences now open from the account menu.
export default async function NotificationSettingsPage() {
  const context = await getRequestContext();
  if (!context.authenticated) redirect("/auth/sign-in?next=%2Fwork");
  const workspace = context.status === "authorized" && context.workspace && context.membership?.status === "active"
    ? scheduleWorkspaceKeys[context.workspace.id] : undefined;
  const crew = workspace && context.user?.id ? await crewPersonForUser(workspace, context.user.id) : null;
  redirect(crew ? "/work/my-schedule" : "/work");
}
