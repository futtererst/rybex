import Link from "next/link";
import { notFound } from "next/navigation";
import { getRequestContext } from "@/lib/d5o/auth/request-context";
import { assertDiscoverTrialEnvironment } from "@/lib/d5o/discover/trial-environment";
import { DiscoverCorrectionWorkspace } from "../DiscoverCorrectionWorkspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Discover duplicate correction trial | D5O" };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function DiscoverWorkCorrectionPage({ params }: {
  params: Promise<{ workId: string }>;
}) {
  assertDiscoverTrialEnvironment();
  const { workId } = await params;
  if (!uuid.test(workId)) notFound();
  const context = await getRequestContext();
  if (!context.authenticated) return <main style={{ padding: 32 }}><h1>Correction reviewer sign-in required</h1>
    <Link href={`/auth/sign-in?next=${encodeURIComponent(`/discover-trial/correction/${workId}`)}`}>Sign in</Link></main>;
  if (context.status !== "authorized" || !context.workspace?.id) {
    return <main style={{ padding: 32 }}><h1>Discover correction unavailable</h1></main>;
  }
  if (!["a2000000-0000-4000-8000-000000000001",
    "a2000000-0000-4000-8000-000000000002"].includes(context.workspace.id)) notFound();
  return <DiscoverCorrectionWorkspace workspaceId={context.workspace.id} workId={workId} />;
}
