import Link from "next/link";
import { getRequestContext } from "@/lib/d5o/auth/request-context";
import { loadG1ReviewQueue } from "@/lib/d5o/discover/g1-review-queue";
import { assertDiscoverTrialEnvironment } from "@/lib/d5o/discover/trial-environment";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "G1 decision queue | D5O trial" };

export default async function G1ReviewPage() {
  assertDiscoverTrialEnvironment();
  const context = await getRequestContext();
  if (!context.authenticated) return <main className={styles.page}><h1>Sign in required</h1>
    <Link href="/auth/sign-in?next=/discover-trial/g1-review">Sign in to review G1</Link></main>;
  const workspaceId = context.status === "authorized" ? context.workspace?.id : undefined;
  if (!workspaceId) return <main className={styles.page}><h1>G1 review unavailable</h1>
    <p>No active trial workspace is available for this identity.</p></main>;
  const queue = await loadG1ReviewQueue(workspaceId);
  return <main className={styles.page}>
    <Link href="/discover-trial?view=workspace">← Discover opportunities</Link>
    <p className={styles.eyebrow}>Work / Commercial / Discover</p>
    <h1>G1 decision queue</h1>
    <p>These are submitted assessments awaiting a separate pursuit decision in your workspace. Qualification does not authorize spending.</p>
    {queue.status === "denied" ? <div className={styles.notice}>This identity has no explicit G1 decision grant.</div> : null}
    {queue.status === "unavailable" || queue.status === "invalid"
      ? <div className={styles.notice}>The queue is unavailable. Refresh before taking a decision.</div> : null}
    {queue.status === "ok" && queue.items.length === 0
      ? <div className={styles.notice}>No submitted G1 assessments currently await your decision.</div> : null}
    {queue.status === "ok" && queue.items.length > 0 ? <div className={styles.list}>
      {queue.items.map(item => <article key={item.assessment_id} className={styles.card}>
        <div><h2>{item.title}</h2><p>{item.account_name ?? "Account unavailable"} · {item.site_name ?? "Site unavailable"}</p>
          <small>Work {item.work_id} · version {item.record_version} · assessment revision {item.assessment_revision}</small></div>
        <Link href={`/discover-trial/opportunity/${item.work_id}`}>Review frozen package</Link>
      </article>)}
    </div> : null}
  </main>;
}
