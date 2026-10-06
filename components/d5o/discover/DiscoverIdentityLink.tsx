"use client";

import { useEffect, useState } from "react";
import type { IdentityContextResult, IdentityLinkResult } from "@/lib/d5o/discover/identity-link";
import styles from "./DiscoverDraftCollection.module.css";

type Props = {
  workId: string;
  recordVersion: number;
  load: (workId: string) => Promise<IdentityContextResult>;
  link: (input: { workId: string; expectedVersion: number; commandId: string;
    accountId: string; siteId: string }) => Promise<IdentityLinkResult>;
  onLinked: () => void;
};

export function DiscoverIdentityLink({ workId, recordVersion, load, link, onLinked }: Props) {
  const [result, setResult] = useState<IdentityContextResult | null>(null);
  const [accountId, setAccountId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [pendingCommand, setPendingCommand] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) void load(workId).then(value => { if (active) setResult(value); })
      .catch(() => { if (active) setResult({ status: "unavailable" }); }); });
    return () => { active = false; };
  }, [load, workId]);

  async function confirm() {
    if (result?.status !== "ok" || !accountId || !siteId || busy) return;
    const commandId = pendingCommand ?? `discover-link-${crypto.randomUUID()}`;
    setPendingCommand(commandId); setBusy(true); setFeedback("");
    try {
      const outcome = await link({ workId, expectedVersion: recordVersion, commandId, accountId, siteId });
      if (outcome.status === "linked") {
        setPendingCommand(null); setFeedback("Account and site linked to this Work record. Triage remains separate.");
        onLinked();
      } else if (outcome.status === "unknown_outcome") {
        setFeedback("The outcome is unknown. Retry the same confirmation to check its receipt.");
      } else {
        setPendingCommand(null); setFeedback(outcome.message);
      }
    } catch { setFeedback("The outcome is unknown. Retry the same confirmation to check its receipt."); }
    finally { setBusy(false); }
  }

  const value = result?.status === "ok" ? result.value : null;
  const account = value?.accounts.find(row => row.id === value.accountId);
  const site = value?.sites.find(row => row.id === value.siteId);
  const sites = value?.sites.filter(row => row.accountId === accountId) ?? [];
  return <section className={styles.identity} aria-label="Account and site identity">
    <h3>Account and site</h3>
    {result === null ? <p role="status">Loading the tenant registry…</p> : null}
    {result?.status === "denied" ? <p role="alert">Registry access changed. No account details are available.</p> : null}
    {result?.status === "unavailable" ? <p role="alert">The registry is unavailable. Reopen the draft to retry.</p> : null}
    {value?.accountId ? <p><strong>Linked:</strong> {account?.name ?? "Account"} / {site?.name ?? "Site"}<br />
      <small>Confirmed for this Work record. Changing the link requires separate review.</small></p> : null}
    {value && !value.accountId ? <>
      <p>Intake names above are provisional. Choose an active synthetic account and its site, then confirm the link.</p>
      <label htmlFor={`account-${workId}`}>Account</label>
      <select id={`account-${workId}`} value={accountId} disabled={busy}
        onChange={event => { setAccountId(event.target.value); setSiteId(""); setPendingCommand(null); setFeedback(""); }}>
        <option value="">Select account</option>
        {value.accounts.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}
      </select>
      <label htmlFor={`site-${workId}`}>Site within this account</label>
      <select id={`site-${workId}`} value={siteId} disabled={!accountId || busy}
        onChange={event => { setSiteId(event.target.value); setPendingCommand(null); setFeedback(""); }}>
        <option value="">Select site</option>
        {sites.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}
      </select>
      <button type="button" className={styles.secondary} disabled={!accountId || !siteId || busy}
        onClick={() => void confirm()}>{busy ? "Confirming…" : pendingCommand ? "Retry same confirmation" : "Confirm account and site link"}</button>
      {!value.accounts.length ? <p>No active synthetic account is available for this tenant.</p> : null}
    </> : null}
    {feedback ? <p role="status">{feedback}</p> : null}
  </section>;
}
