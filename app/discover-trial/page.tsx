import Link from "next/link";
import { notFound } from "next/navigation";
import { DiscoverTrialWorkspace } from "./DiscoverTrialWorkspace";
import { getRequestContext } from "@/lib/d5o/auth/request-context";
import { assertDiscoverTrialEnvironment } from "@/lib/d5o/discover/trial-environment";
import { loadG1ReviewQueue } from "@/lib/d5o/discover/g1-review-queue";

export const dynamic = "force-dynamic";
export const metadata = { title: "Discover trial | D5O" };

export default async function DiscoverTrialPage() {
  assertDiscoverTrialEnvironment();
  const context = await getRequestContext();
  if (!context.authenticated) {
    return <main style={{ padding: 32 }}><h1>Discover trial sign-in required</h1>
      <p>Use a named synthetic trial account to inspect this isolated draft path.</p>
      <Link href="/auth/sign-in?next=/discover-trial">Sign in</Link></main>;
  }
  if (context.status !== "authorized" || !context.workspace?.id) {
    return <main style={{ padding: 32 }}><h1>Discover trial unavailable</h1>
      <p>No active authorized workspace is available for this account.</p></main>;
  }
  if (![
    "a2000000-0000-4000-8000-000000000001",
    "a2000000-0000-4000-8000-000000000002",
  ].includes(context.workspace.id)) notFound();
  const g1Queue = await loadG1ReviewQueue(context.workspace.id);
  return <DiscoverTrialWorkspace workspaceId={context.workspace.id} showG1ReviewLink={g1Queue.status === "ok"} />;
}
