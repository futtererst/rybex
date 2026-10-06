import Link from "next/link";
import { notFound } from "next/navigation";
import { getRequestContext } from "@/lib/d5o/auth/request-context";
import { assertDiscoverTrialEnvironment } from "@/lib/d5o/discover/trial-environment";
import { listRmJobs } from "@/lib/d5o/rm02-trial";
import { listD4PackageDrafts } from "@/lib/d5o/d4-package-trial";
import { listD4FieldReviews } from "@/lib/d5o/d4-buildability-trial";
import { getD4ClearanceMatrix } from "@/lib/d5o/d4-clearance-matrix-trial";
import { PackageDraftWorkspace } from "./PackageDraftWorkspace";
import styles from "./packages.module.css";

export const dynamic="force-dynamic";
export const metadata={title:"D4 package drafts | D5O trial"};
export default async function PackageDraftPage({searchParams}:{
  searchParams:Promise<{workId?:string}>}){
  assertDiscoverTrialEnvironment();
  const context=await getRequestContext();
  if(!context.authenticated)return <main className={styles.shell}>
    <h1>Sign in to package drafts</h1>
    <Link href="/auth/sign-in?next=/discover-trial/packages">Sign in</Link></main>;
  if(context.status!=="authorized"||!context.workspace?.id)
    return <main className={styles.shell}><h1>No active workspace</h1></main>;
  if(context.workspace.id!=="a2000000-0000-4000-8000-000000000001")notFound();
  const jobs=await listRmJobs(context.workspace.id);
  if(jobs.status!=="ok")return <main className={styles.shell}>
    <h1>Package drafts unavailable</h1><p>Job access: {jobs.status}.</p></main>;
  const chosen=(await searchParams).workId;
  const job=jobs.items.find(x=>x.workId===chosen)??jobs.items[0];
  if(!job)return <main className={styles.shell}><h1>No field job</h1>
    <Link href="/discover-trial/jobs">Open field jobs</Link></main>;
  const [packages,fieldReviews]=await Promise.all([
    listD4PackageDrafts(context.workspace.id,job.workId),
    listD4FieldReviews(context.workspace.id,job.workId)]);
  if(packages.status!=="ok"||fieldReviews.status!=="ok")
    return <main className={styles.shell}>
      <h1>Package drafts unavailable</h1>
      <p>Draft access: {packages.status}; field review: {fieldReviews.status}.</p></main>;
  const matrix=packages.items[0]
    ?await getD4ClearanceMatrix({workspaceId:context.workspace.id,
      packageId:packages.items[0].id}):null;
  return <PackageDraftWorkspace jobs={jobs.items} job={job}
    packages={packages} fieldReviews={fieldReviews}
    initialMatrix={matrix?.status==="ok"?matrix.matrix:null}/>;
}
