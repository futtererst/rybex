import Link from "next/link";
import { notFound } from "next/navigation";
import { getRequestContext } from "@/lib/d5o/auth/request-context";
import { assertDiscoverTrialEnvironment } from "@/lib/d5o/discover/trial-environment";
import { listRmJobs } from "@/lib/d5o/rm02-trial";
import { JobPlanningWorkspace } from "./JobPlanningWorkspace";
import styles from "./jobs.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Field job planning | D5O trial" };

export default async function FieldJobsTrialPage() {
  assertDiscoverTrialEnvironment();
  const context = await getRequestContext();
  if (!context.authenticated) return <main className={styles.shell}>
    <h1>Sign in to field job planning</h1>
    <Link href="/auth/sign-in?next=/discover-trial/jobs">Sign in</Link></main>;
  if (context.status !== "authorized" || !context.workspace?.id)
    return <main className={styles.shell}><h1>No active workspace</h1></main>;
  if (context.workspace.id !== "a2000000-0000-4000-8000-000000000001") notFound();
  const result = await listRmJobs(context.workspace.id);
  if (result.status !== "ok") return <main className={styles.shell}>
    <h1>Job planning unavailable</h1><p>Result: {result.status}</p>
    <Link href="/discover-trial">Back to Discover</Link></main>;
  return <JobPlanningWorkspace data={result} />;
}
