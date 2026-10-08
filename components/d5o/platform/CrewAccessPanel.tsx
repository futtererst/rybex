"use client";

import { useEffect, useState, type FormEvent } from "react";
import styles from "./CrewAccessPanel.module.css";

type Binding = { person: string; email: string; active: boolean; userId: string };
type Access = { bindings: Binding[]; people: string[] };

export function CrewAccessPanel({ onClose }: { onClose: () => void }) {
  const [access, setAccess] = useState<Access | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    fetch("/api/d5o-hosted/crew-access", { cache: "no-store" })
      .then(async (response) => { if (!response.ok) throw new Error("Worker access is unavailable. Check the hosted admin configuration."); return response.json() as Promise<Access>; })
      .then((result) => { if (active) setAccess(result); })
      .catch((error) => { if (active) setMessage(error instanceof Error ? error.message : "Worker access is unavailable."); });
    return () => { active = false; };
  }, []);

  async function bind(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget, data = new FormData(form);
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/d5o-hosted/crew-access", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ person: data.get("person"), email: data.get("email") }) });
      const result = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(result.message ?? result.error ?? "Binding could not be saved.");
      const refreshed = await fetch("/api/d5o-hosted/crew-access", { cache: "no-store" });
      if (!refreshed.ok) throw new Error("Binding saved; refresh to load the current roster.");
      setAccess(await refreshed.json() as Access);
      setMessage("The confirmed worker account is linked to this crew person and D5O workspace.");
      form.reset();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Binding could not be saved."); }
    finally { setBusy(false); }
  }

  return <section className={styles.panel} aria-label="Worker access">
      <div className={styles.heading}><div><p>RYBEX · SYSTEM ADMINISTRATOR</p><h2>Connect workers to crew bookings</h2><span>Bind an existing confirmed sign-in account to one roster person. A booking still requires publication and worker response.</span></div><button type="button" onClick={onClose}>Close</button></div>
      {message ? <p role="status" className={styles.message}>{message}</p> : null}
      {access ? <><div className={styles.list}>{access.bindings.map((binding) => <div key={binding.userId}><strong>{binding.person}</strong><span>{binding.email}</span><small>{binding.active ? "Active worker access" : "Inactive"}</small></div>)}{!access.bindings.length ? <p>No worker accounts are bound to this roster.</p> : null}</div>
        <form className={styles.form} onSubmit={bind}><label>Crew person<select name="person" required defaultValue=""><option value="" disabled>Choose person</option>{access.people.filter((person) => !access.bindings.some((binding) => binding.person === person && binding.active)).map((person) => <option key={person}>{person}</option>)}</select></label><label>Confirmed sign-in email<input name="email" type="email" autoComplete="off" required placeholder="worker@example.com" /></label><button className="d5o-primary" disabled={busy || access.people.every((person) => access.bindings.some((binding) => binding.person === person && binding.active))}>Bind worker</button></form>
        <p className={styles.note}>Prototype roster identities are synthetic. This action grants only the field-worker membership and that person’s scoped work; it does not authorize releases, reviews or approvals.</p></> : <p role="status">Loading worker access…</p>}
    </section>;
}
