"use client";

import { useEffect, useState, type FormEvent } from "react";
import styles from "./CrewAccessPanel.module.css";
import type { WorkforcePerson } from "./useWorkforce";

type State = { revision: number; people: WorkforcePerson[] };
export function CrewAccessPanel() {
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<WorkforcePerson | null>(null);
  async function load() {
    const response = await fetch("/api/d5o-hosted/workforce?workspace=rybex", { cache: "no-store" });
    const body = await response.json() as State & { error?: string };
    if (!response.ok) throw new Error(body.error ?? "Workforce unavailable");
    setState(body);
  }
  useEffect(() => { void Promise.resolve().then(load).catch((failure) => setError(failure instanceof Error ? failure.message : "Workforce unavailable")); }, []);
  async function command(action: string, data: Record<string, unknown>) {
    if (!state) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/d5o-hosted/workforce", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace: "rybex", action, data,
          commandId: crypto.randomUUID(), expectedRevision: state.revision })
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Workforce change rejected");
      await load(); setSelected(null);
      window.dispatchEvent(new Event("d5o-workforce-updated"));
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Workforce unavailable"); }
    finally { setBusy(false); }
  }
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const person = String(values.get("person") ?? "").trim();
    const displayName = String(values.get("displayName") ?? "").trim();
    const qualifications = String(values.get("qualifications") ?? "").split(",").map((item) => item.trim()).filter(Boolean);
    void command("save-person", { ...(selected ? { id: selected.id } : {}),
      person, displayName, qualifications, weeklyCapacityHours: Number(values.get("capacity")), active: selected?.active ?? true });
  }
  return <section className={styles.panel} aria-label="Workforce administration">
    <div className={styles.heading}><div><p>WORKFORCE · SYSTEM ADMINISTRATOR</p><h2>People and qualifications</h2><span>Create a fictional roster person, record skills and weekly capacity, then connect an existing confirmed account. Only active, qualified, bound people can be booked. Account creation remains in the isolated Auth administrator flow.</span></div></div>
    {error ? <p role="alert" className={styles.message}>{error}</p> : null}
    {!state ? <p role="status">Loading committed workforce…</p> : <>
      <div className={styles.list}>{state.people.map((item) => <div key={item.id}>
        <strong>{item.displayName}</strong><span>{item.qualifications.join(" · ")} · {item.weeklyCapacityHours}h/week</span>
        <small>{!item.active ? "Inactive" : item.bound ? `Account bound: ${item.email ?? item.workerUserId ?? "confirmed"}` : "Unbound — planning only"}</small>
        <button type="button" disabled={busy} onClick={() => setSelected(item)}>Edit</button>
        <button type="button" disabled={busy} onClick={() => void command("set-active", { id: item.id, active: !item.active })}>{item.active ? "Deactivate" : "Reactivate"}</button>
      </div>)}{!state.people.length ? <p>No committed workforce records yet.</p> : null}</div>
      <form className={styles.form} key={selected?.id ?? "new"} onSubmit={save}>
        <label>Stable roster identity<input name="person" required minLength={2} defaultValue={selected?.person ?? ""} readOnly={Boolean(selected)} placeholder="Fictional worker name" /></label>
        <label>Display name<input name="displayName" required defaultValue={selected?.displayName ?? ""} /></label>
        <label>Qualifications, comma separated<input name="qualifications" required defaultValue={selected?.qualifications.join(", ") ?? ""} /></label>
        <label>Weekly capacity (hours)<input name="capacity" required type="number" min="1" max="80" step="0.5" defaultValue={selected?.weeklyCapacityHours ?? 40} /></label>
        <button className="d5o-primary" disabled={busy}>{selected ? "Save person" : "Add person"}</button>
        {selected ? <button type="button" onClick={() => setSelected(null)}>Cancel</button> : null}
      </form>
      {state.people.filter((item) => item.active && !item.bound).map((item) =>
        <form className={styles.form} key={item.id} onSubmit={(event) => {
          event.preventDefault(); const data = new FormData(event.currentTarget);
          void command("bind-person", { id: item.id, email: String(data.get("email") ?? "").trim() });
        }}><strong>Connect {item.displayName}</strong><label>Existing confirmed sign-in email<input name="email" type="email" required autoComplete="off" /></label><button disabled={busy}>Bind account</button></form>)}
      <p className={styles.note}>These fictional workforce records are scoped to the isolated Rybex workspace. A binding grants only field-worker access; it does not authorize releases, reviews or Finance decisions.</p>
    </>}
  </section>;
}
