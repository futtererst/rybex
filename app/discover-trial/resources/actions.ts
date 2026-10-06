"use server";

import { redirect } from "next/navigation";
import { getRequestContext } from "@/lib/d5o/auth/request-context";
import { saveRmProfile, type RmProfile } from "@/lib/d5o/rm01-trial";

export async function saveResourceAction(form: FormData) {
  const context = await getRequestContext();
  const workspaceId = context.status === "authorized" ? context.workspace?.id : undefined;
  const resourceId = String(form.get("resourceId") ?? "") || null;
  const csv = (key: string) => String(form.get(key) ?? "")
    .split(",").map(x => x.trim()).filter(Boolean);
  const profile: RmProfile = {
    name: String(form.get("name") ?? ""),
    grade: String(form.get("grade") ?? ""),
    skills: csv("skills"), certificates: csv("certificates"),
    homeBase: String(form.get("homeBase") ?? ""),
    region: String(form.get("region") ?? ""),
    workingDays: form.getAll("workingDays").map(String),
    workStart: String(form.get("workStart") ?? ""),
    workEnd: String(form.get("workEnd") ?? ""),
    ptoDates: csv("ptoDates"),
    employmentType: String(form.get("employmentType") ?? "") as "W2" | "1099",
    active: form.get("active") === "true",
    linkedUserId: String(form.get("linkedUserId") ?? "") || null,
  };
  const result = workspaceId
    ? await saveRmProfile({ workspaceId, resourceId,
        expectedRevision: Number(form.get("revision")),
        commandId: String(form.get("commandId") ?? ""), profile })
    : { status: "denied" as const };
  const query = new URLSearchParams({ result: result.status });
  if (result.status === "saved") query.set("edit", result.resourceId);
  else if (resourceId) query.set("edit", resourceId);
  redirect(`/discover-trial/resources?${query}`);
}
