import Link from "next/link";
import { notFound } from "next/navigation";
import { getRequestContext } from "@/lib/d5o/auth/request-context";
import { assertDiscoverTrialEnvironment } from "@/lib/d5o/discover/trial-environment";
import { listRmProfiles, type RmProfile } from "@/lib/d5o/rm01-trial";
import { saveResourceAction } from "./actions";
import styles from "./resources.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Resource profiles | D5O trial" };
const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const blank: RmProfile = {
  name: "", grade: "", skills: [], certificates: [], homeBase: "", region: "",
  workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri"], workStart: "08:00",
  workEnd: "17:00", ptoDates: [], employmentType: "W2", active: true,
  linkedUserId: null,
};
const messages: Record<string, string> = {
  saved: "Profile saved with an audit receipt. The list shows its current revision.",
  denied: "This identity cannot make that change. Check its verified membership and explicit resource grant.",
  conflict: "This profile changed since it was opened. Review the current revision before saving again.",
  invalid: "Some profile details are invalid. Check the required fields, dates and hours.",
  unavailable: "The profile could not be saved. Retry after the scratch service is available.",
};

export default async function ResourceTrialPage({ searchParams }: {
  searchParams: Promise<{ edit?: string; result?: string; q?: string }>;
}) {
  assertDiscoverTrialEnvironment();
  const context = await getRequestContext();
  if (!context.authenticated) return <main className={styles.shell}>
    <h1>Sign in to the resource trial</h1>
    <Link href="/auth/sign-in?next=/discover-trial/resources">Sign in</Link></main>;
  if (context.status !== "authorized" || !context.workspace?.id)
    return <main className={styles.shell}><h1>No active workspace</h1></main>;
  if (context.workspace.id !== "a2000000-0000-4000-8000-000000000001") notFound();
  const result = await listRmProfiles(context.workspace.id);
  if (result.status !== "ok") return <main className={styles.shell}>
    <h1>Resource profiles unavailable</h1><p>Result: {result.status}</p>
    <Link href="/discover-trial">Back to Discover</Link></main>;
  const params = await searchParams;
  const selected = result.items.find(x => x.resourceId === params.edit);
  const query = (params.q ?? "").trim().toLocaleLowerCase();
  const items = query ? result.items.filter(x => [x.profile.name, x.profile.grade,
    x.profile.region, x.profile.homeBase, ...x.profile.skills,
    ...x.profile.certificates].some(v => v.toLocaleLowerCase().includes(query))) : result.items;
  const profile = selected?.profile ?? blank;
  const canWrite = selected ? result.canEdit : result.canCreate;
  const canControl = context.role === "admin" && canWrite;
  return <main className={styles.shell}>
    <nav className={styles.nav}><Link href="/discover-trial">Discover</Link><span> / Resource profiles · </span><Link href="/discover-trial/jobs">Field job planning</Link></nav>
    <header><p className={styles.eyebrow}>RM01 · bounded trial</p>
      <h1>Technician profiles</h1>
      <p>Find a technician by skill, region or name and inspect working hours. Each save creates a new revision and audit receipt.</p>
    </header>
    <div className={styles.notice}>This is a synthetic trial workspace. Protected cost rates are outside this screen and its API. Availability here describes the profile; scheduling and field assignment are separate steps.</div>
    {params.result && messages[params.result] && <p role="status" className={styles.status}>{messages[params.result]}</p>}
    <div className={styles.grid}>
      <section aria-label="Technician list" className={styles.panel}>
        <div className={styles.panelHead}><h2>Technicians <small>({items.length})</small></h2>
          {result.canCreate && <Link className={styles.buttonLink} href="/discover-trial/resources">New technician</Link>}</div>
        <form method="get" className={styles.search}><label htmlFor="resource-q">Search profiles</label>
          <input id="resource-q" name="q" defaultValue={params.q ?? ""} placeholder="Name, skill, region or base" />
          <button type="submit">Find</button></form>
        {result.items.length === 0 && <p>No technician profiles yet. Create the first one to exercise the resource workflow.</p>}
        {result.items.length > 0 && items.length === 0 && <p>No profiles match that search.</p>}
        {items.map(item => <Link key={item.resourceId}
          className={`${styles.card} ${selected?.resourceId === item.resourceId ? styles.selected : ""}`}
          href={`/discover-trial/resources?edit=${encodeURIComponent(item.resourceId)}`}>
          <strong>{item.profile.name}</strong><span>{item.technicianCode} · {item.profile.grade}</span>
          <span>{item.profile.skills.join(", ")}</span>
          <span>{item.profile.region} · {item.profile.workingDays.join("/")} · {item.profile.workStart}–{item.profile.workEnd}</span>
          <em>{item.profile.active ? "Active" : "Inactive · existing bookings require reassignment"} · revision {item.revision}</em>
        </Link>)}
      </section>
      <section aria-label="Technician profile" className={styles.panel}>
        <div className={styles.panelHead}><div><p className={styles.eyebrow}>{selected ? selected.technicianCode : "New technician"}</p>
          <h2>{selected ? selected.profile.name : "Create technician"}</h2></div>
          {selected && <small>Revision {selected.revision}</small>}</div>
        {!canWrite && <div className={styles.notice}>Read-only for this identity. An explicit operational edit grant is required.</div>}
        <form action={saveResourceAction} className={styles.form}>
          <input type="hidden" name="resourceId" value={selected?.resourceId ?? ""} />
          <input type="hidden" name="revision" value={selected?.revision ?? 0} />
          <input type="hidden" name="commandId" value={crypto.randomUUID()} />
          <label>Technician name<input name="name" defaultValue={profile.name} required minLength={3} maxLength={160} disabled={!canWrite} /></label>
          <div className={styles.pair}><label>Grade<input name="grade" defaultValue={profile.grade} required disabled={!canWrite} /></label>
            <label>Home base<input name="homeBase" defaultValue={profile.homeBase} required disabled={!canWrite} /></label></div>
          <label>Skills <small>comma separated</small><input name="skills" defaultValue={profile.skills.join(", ")} required disabled={!canWrite} placeholder="Electrical, Controls" /></label>
          <label>Certificates <small>comma separated</small><input name="certificates" defaultValue={profile.certificates.join(", ")} disabled={!canWrite} placeholder="OSHA 30" /></label>
          <label>Region<input name="region" defaultValue={profile.region} required disabled={!canWrite} /></label>
          <fieldset disabled={!canWrite}><legend>Working days</legend><div className={styles.days}>
            {weekdays.map(day => <label key={day}><input type="checkbox" name="workingDays" value={day}
              defaultChecked={profile.workingDays.includes(day)} />{day}</label>)}
          </div></fieldset>
          <div className={styles.pair}><label>Start time<input type="time" name="workStart" defaultValue={profile.workStart} required disabled={!canWrite} /></label>
            <label>End time<input type="time" name="workEnd" defaultValue={profile.workEnd} required disabled={!canWrite} /></label></div>
          <label>PTO dates <small>YYYY-MM-DD, comma separated</small><input name="ptoDates" defaultValue={profile.ptoDates.join(", ")} disabled={!canWrite} /></label>
          <div className={styles.pair}><label>Employment type<select name="employmentType" defaultValue={profile.employmentType} disabled={!canControl}>
            <option value="W2">Employee</option><option value="1099">Contractor</option></select></label>
            <label>Status<select name="active" defaultValue={String(profile.active)} disabled={!canControl}>
              <option value="true">Active</option><option value="false">Inactive</option></select></label></div>
          <input type="hidden" name="employmentType" value={profile.employmentType} disabled={canControl} />
          <input type="hidden" name="active" value={String(profile.active)} disabled={canControl} />
          <input type="hidden" name="linkedUserId" value={profile.linkedUserId ?? ""} />
          <p className={styles.hint}>Only an administrator can change employment type, linked identity, or active status. Operational editors can change skills, certificates, region, hours and PTO.</p>
          {canWrite && <button type="submit">{selected ? "Save new revision" : "Create technician"}</button>}
        </form>
      </section>
    </div>
  </main>;
}
