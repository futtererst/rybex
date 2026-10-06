import Link from "next/link";
import { notFound } from "next/navigation";
import { getRequestContext } from "@/lib/d5o/auth/request-context";
import { assertDiscoverTrialEnvironment } from "@/lib/d5o/discover/trial-environment";
import { DiscoverDuplicateReviewWorkspace } from "./DiscoverDuplicateReviewWorkspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Discover duplicate review trial | D5O" };

export default async function DiscoverDuplicateReviewPage() {
  assertDiscoverTrialEnvironment();
  const context = await getRequestContext();
  if (!context.authenticated) return <main style={{ padding: 32 }}><h1>Discover reviewer sign-in required</h1>
    <Link href="/auth/sign-in?next=/discover-trial/review">Sign in</Link></main>;
  if (context.status !== "authorized" || !context.workspace?.id) {
    return <main style={{ padding: 32 }}><h1>Discover review unavailable</h1></main>;
  }
  if (![
    "a2000000-0000-4000-8000-000000000001",
    "a2000000-0000-4000-8000-000000000002",
  ].includes(context.workspace.id)) notFound();
  return <DiscoverDuplicateReviewWorkspace workspaceId={context.workspace.id} />;
}
