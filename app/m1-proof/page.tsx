import { redirect } from "next/navigation";

export const metadata = { title: "D5O Work" };

type LegacyProofRouteProps = { searchParams: Promise<{ workspace?: string; work?: string }> };

// Preserve legacy links while routing people into the actual operating surface.
export default async function LegacyProofRoute({ searchParams }: LegacyProofRouteProps) {
  const { workspace, work } = await searchParams;
  if (workspace && work) redirect(`/work/${encodeURIComponent(workspace)}/${encodeURIComponent(work)}`);
  redirect("/work");
}
