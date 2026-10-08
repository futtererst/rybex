import Link from "next/link";
import { notFound } from "next/navigation";
import { getRequestContext } from "@/lib/d5o/auth/request-context";
import { assertDiscoverTrialEnvironment } from "@/lib/d5o/discover/trial-environment";
import { listRmProfiles } from "@/lib/d5o/rm01-trial";
import { listRmJobs } from "@/lib/d5o/rm02-trial";
import { listRmPlanShifts } from "@/lib/d5o/rm03-trial";
import { DispatchPlanningWorkspace } from "./DispatchPlanningWorkspace";
import styles from "./dispatch.module.css";

export const dynamic="force-dynamic";
export const metadata={title:"Tentative crew planning | D5O trial"};
export default async function DispatchTrialPage(){
  assertDiscoverTrialEnvironment();
  const context=await getRequestContext();
  if(!context.authenticated)return <main className={styles.shell}>
    <h1>Sign in to crew planning</h1>
    <Link href="/auth/sign-in?next=/discover-trial/dispatch">Sign in</Link></main>;
  if(context.status!=="authorized"||!context.workspace?.id)
    return <main className={styles.shell}><h1>No active workspace</h1></main>;
  if(context.workspace.id!=="a2000000-0000-4000-8000-000000000001")notFound();
  const [profiles,jobs,plans]=await Promise.all([
    listRmProfiles(context.workspace.id),listRmJobs(context.workspace.id),
    listRmPlanShifts(context.workspace.id)]);
  if(profiles.status!=="ok"||jobs.status!=="ok"||plans.status!=="ok")
    return <main className={styles.shell}><h1>Crew planning unavailable</h1>
      <p>Profiles: {profiles.status}; jobs: {jobs.status}; plans: {plans.status}.</p>
      <Link href="/discover-trial">Back to Discover</Link></main>;
  return <DispatchPlanningWorkspace profiles={profiles} jobs={jobs} plans={plans}/>;
}
