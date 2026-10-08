"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createConfigurationDraft, saveConfigurationDraft, publishConfigurationDraft, activateConfigurationVersion } from "@/app/work/configuration-actions";
import type { ConfigurationInventory } from "@/lib/d5o/configuration/version-inventory";
import { prototypePhaseConfigurationCatalog, type PhaseKey } from "./phase-configuration";
import { defaultPhaseContract, phaseContractFromManifest, validatePublishedPhaseContract } from "./published-phase-configuration";
import { PhaseContractEditor } from "./PhaseContractEditor";
import { defaultDiscoverPolicy, resolveDiscoverPolicy, validateDiscoverPolicy, type DiscoverPolicy } from "./discover-decision";
import type { WorkspaceKey } from "./work-types";

const phaseKeys: PhaseKey[] = ["discover", "define", "develop", "design", "deploy", "operate"];
function phaseLabels(manifest: Record<string, unknown> | undefined, workspace: WorkspaceKey): Record<string, string> {
  const presentation = manifest?.d5oPresentation as Record<string, unknown> | undefined;
  const saved = presentation?.phaseLabels as Record<string, unknown> | undefined;
  return Object.fromEntries(phaseKeys.map((key) => [key, typeof saved?.[key] === "string" ? saved[key] : prototypePhaseConfigurationCatalog[workspace][0].phases.find((phase) => phase.key === key)?.label ?? key]));
}

export function ConfigurationPublicationPanel({ inventory, workspace }: { inventory: ConfigurationInventory; workspace: WorkspaceKey }) {
  const active = inventory.versions.find((version) => version.id === inventory.activeVersionId);
  const existing = inventory.versions.find((version) => version.status === "draft" && version.config_manifest_json?.d5oSourceVersionId === active?.id);
  const publishedCandidate = inventory.versions.find((version) => version.status === "published" && version.id !== active?.id && version.config_manifest_json?.d5oSourceVersionId === active?.id);
  const [draftId, setDraftId] = useState(existing?.id ?? "");
  const [candidateId, setCandidateId] = useState(publishedCandidate?.id ?? "");
  const [labels, setLabels] = useState(() => phaseLabels(existing?.config_manifest_json ?? active?.config_manifest_json, workspace));
  const [phaseContract, setPhaseContract] = useState(() => phaseContractFromManifest(existing?.config_manifest_json ?? active?.config_manifest_json, workspace) ?? defaultPhaseContract(workspace));
  const [discoverPolicy, setDiscoverPolicy] = useState<Omit<DiscoverPolicy, "version">>(() => { const policy = resolveDiscoverPolicy(existing?.config_manifest_json ?? active?.config_manifest_json, active?.id ?? ""); return policy.source === "published" ? { ...policy, source: "published" } : defaultDiscoverPolicy(); });
  const [reason, setReason] = useState(() => String((existing?.config_manifest_json?.d5oPresentation as Record<string, unknown> | undefined)?.changeReason ?? ""));
  const [saved, setSaved] = useState(Boolean(phaseContractFromManifest(existing?.config_manifest_json, workspace)));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();
  if (!inventory.canAdminister || inventory.status !== "ready" || !active) return null;
  const contractErrors = validatePublishedPhaseContract(phaseContract, workspace);
  const policyErrors = validateDiscoverPolicy(discoverPolicy);

  async function run(command: "create" | "save" | "publish" | "activate") {
    if (!active) return;
    setBusy(true); setMessage("");
    const result = command === "create"
      ? await createConfigurationDraft(inventory.workspaceId, active.id)
      : command === "save"
        ? await saveConfigurationDraft(inventory.workspaceId, draftId, labels, reason, phaseContract, workspace, discoverPolicy)
        : command === "publish"
          ? await publishConfigurationDraft(inventory.workspaceId, draftId, active.id)
          : await activateConfigurationVersion(inventory.workspaceId, candidateId, active.id);
    setBusy(false);
    if (!result.ok) { setMessage(result.error); return; }
    if (command === "create") { setDraftId(result.draftVersionId ?? ""); setSaved(false); setMessage("Complete configuration copied into a non-authoritative draft. Define the phase form contract before publishing."); }
    if (command === "save") { setSaved(true); setMessage("Draft saved. Publication validates the versioned phase forms and the governing gate graph."); }
    if (command === "publish") { setDraftId(""); setSaved(false); setCandidateId(result.publishedVersionId ?? ""); setMessage("Complete version published. The workspace default is unchanged until activation."); router.refresh(); }
    if (command === "activate") { setCandidateId(""); setMessage(`Version ${result.publishedVersionId} is now the default for new Work Records.`); router.refresh(); }
  }

  return <section className="d5o-publication" aria-label="Configuration publication">
    <header><div><p>SERVER-OWNED CONFIGURATION · SYSTEM ADMINISTRATOR</p><h2>Draft and publish a complete version.</h2><span>Each draft copies the active gate, evidence, and authority graph. Discover and Define phase forms are stored with the same version; existing work keeps its pin.</span></div><strong>Active v{active.version}</strong></header>
    {candidateId ? <div className="d5o-publication-editor"><p><b>Published candidate</b> · {candidateId}</p><span>Validation passed. Activation changes only the default for newly captured Work Records.</span><button type="button" disabled={busy} onClick={() => run("activate")}>Activate as new default</button></div> : null}
    {!draftId ? <button type="button" disabled={busy} onClick={() => run("create")}>Create complete draft from v{active.version}</button> : <div className="d5o-publication-editor">
      <p><b>Unpublished draft</b> · {draftId}</p>
      <div className="d5o-publication-fields">{phaseKeys.map((key) => <label key={key}>{key}<input value={labels[key]} maxLength={80} onChange={(event) => { setLabels({ ...labels, [key]: event.target.value }); setSaved(false); }} /></label>)}</div>
      {phaseContract.workTypes.every((item) => item.version === "prototype-v1") ? <button type="button" disabled={busy} onClick={() => { setPhaseContract(defaultPhaseContract(workspace)); setSaved(false); setReason("Align Discover qualification, Define baseline and Develop commercial work"); }}>Apply stage-aligned D1–D3 contract to this draft</button> : null}
      <PhaseContractEditor value={phaseContract} onChange={(next) => { setPhaseContract(next); setSaved(false); }} />
      <fieldset className="d5o-publication-fields"><legend>Discover pursuit decision policy · synthetic values until this draft is published</legend>{(Object.keys(discoverPolicy.weights) as Array<keyof DiscoverPolicy["weights"]>).map((key) => <label key={key}>{key.replace(/([A-Z])/g, " $1")} weight %<input type="number" min="0" max="100" value={discoverPolicy.weights[key]} onChange={(event) => { setDiscoverPolicy({ ...discoverPolicy, weights: { ...discoverPolicy.weights, [key]: Number(event.target.value) } }); setSaved(false); }} /></label>)}<label>Pursue threshold<input type="number" min="0" max="100" value={discoverPolicy.pursueThreshold} onChange={(event) => { setDiscoverPolicy({ ...discoverPolicy, pursueThreshold: Number(event.target.value) }); setSaved(false); }} /></label><label>Conditional threshold<input type="number" min="0" max="100" value={discoverPolicy.conditionalThreshold} onChange={(event) => { setDiscoverPolicy({ ...discoverPolicy, conditionalThreshold: Number(event.target.value) }); setSaved(false); }} /></label><label>Escalate if risk manageability falls below<input type="number" min="0" max="5" value={discoverPolicy.riskEscalationBelow} onChange={(event) => { setDiscoverPolicy({ ...discoverPolicy, riskEscalationBelow: Number(event.target.value) }); setSaved(false); }} /></label><div><strong>Mandatory facts before positive qualification</strong>{(["customer", "site", "need", "owner", "buyingProcess", "decisionMaker", "funding", "awardDate"] as const).map((key) => <label key={key}><input type="checkbox" checked={discoverPolicy.required.includes(key)} disabled={key === "decisionMaker" || key === "funding"} onChange={(event) => { setDiscoverPolicy({ ...discoverPolicy, required: event.target.checked ? [...discoverPolicy.required, key] : discoverPolicy.required.filter((item) => item !== key) }); setSaved(false); }} />{key.replace(/([A-Z])/g, " $1")}</label>)}</div><small>0 means weak and 5 means strong evidence-backed assessment. Decision-maker and funding cannot be removed from mandatory facts. Legal, unsafe-delivery and out-of-scope restrictions are non-waivable; no exception rights are granted by this prototype policy.</small></fieldset>
      <label className="d5o-publication-reason">Change reason<input value={reason} maxLength={240} placeholder="Why is this version being published?" onChange={(event) => { setReason(event.target.value); setSaved(false); }} /></label>
      {contractErrors.length ? <p className="d5o-publication-message" role="alert">{contractErrors[0]}</p> : null}
      {policyErrors.length ? <p className="d5o-publication-message" role="alert">{policyErrors[0]}</p> : null}
      <div className="d5o-publication-actions"><button type="button" disabled={busy || reason.trim().length < 8 || Object.values(labels).some((label) => label.trim().length < 2) || contractErrors.length > 0 || policyErrors.length > 0} onClick={() => run("save")}>Save draft</button><button type="button" disabled={busy || !saved} onClick={() => run("publish")}>Validate and publish</button></div>
      <small>Publication is one database transaction. Invalid phase forms, Work Types, gates, evidence, authority or lineage leave the current default unchanged.</small>
    </div>}
    {message ? <p role="status" className="d5o-publication-message">{message}</p> : null}
  </section>;
}
