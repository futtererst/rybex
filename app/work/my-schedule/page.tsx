import { redirect } from "next/navigation";
import { getRequestContext } from "@/lib/d5o/auth/request-context";
import { assertProofEnvironment } from "@/lib/d5o/work-record/server";
import { crewPersonForUser, scheduleWorkspaceKeys } from "@/lib/d5o/scheduling/crew-identity";
import { CrewScheduleView } from "./CrewScheduleView";
import "./crew-schedule.css";
import "../settings/notification-settings.css";

export const metadata = { title: "My crew schedule | D5O" };

export default async function MyCrewSchedulePage() {
  assertProofEnvironment();
  const context = await getRequestContext();
  if (!context.authenticated) redirect("/auth/sign-in?next=%2Fwork%2Fmy-schedule");
  const workspace = context.status === "authorized" && context.workspace && context.membership?.status === "active"
    ? scheduleWorkspaceKeys[context.workspace.id] : undefined;
  const person = workspace && context.user?.id ? await crewPersonForUser(workspace, context.user.id) : null;
  if (!workspace || !person) redirect("/work");
  return <CrewScheduleView workspace={workspace} person={person} />;
}
