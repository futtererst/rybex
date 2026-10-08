import Link from "next/link";
import { notFound } from "next/navigation";
import { getRequestContext } from "@/lib/d5o/auth/request-context";
import { assertDiscoverTrialEnvironment } from "@/lib/d5o/discover/trial-environment";
import { DiscoverTriageQueue } from "./DiscoverTriageQueue";

export const dynamic = "force-dynamic";
export const metadata = { title: "My Discover triage | D5O" };
export default async function DiscoverTriagePage() {
  assertDiscoverTrialEnvironment();
  const context = await getRequestContext();
  if (!context.authenticated) return <main style={{ padding: 32 }}><h1>Sign in required</h1>
    <p>A named synthetic trial owner must sign in to see their assignments.</p>
    <Link href="/auth/sign-in?next=/discover-trial/triage">Sign in</Link></main>;
  if (context.status !== "authorized" || !context.workspace?.id) return <main style={{ padding: 32 }}>
    <h1>Triage unavailable</h1><p>No active authorized workspace is available.</p></main>;
  if (!["a2000000-0000-4000-8000-000000000001", "a2000000-0000-4000-8000-000000000002"].includes(context.workspace.id)) notFound();
  return <DiscoverTriageQueue workspaceId={context.workspace.id} />;
}
