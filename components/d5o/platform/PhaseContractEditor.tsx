"use client";

import { useState } from "react";
import type { PublishedPhaseContract } from "./published-phase-configuration";
import type { PhaseKey } from "./phase-configuration";

const phaseKeys: PhaseKey[] = ["discover", "define", "develop", "design", "deploy", "operate"];

export function PhaseContractEditor({ value, onChange }: { value: PublishedPhaseContract; onChange: (next: PublishedPhaseContract) => void }) {
  const [selectedType, setSelectedType] = useState(value.workTypes[0]?.workTypeKey ?? "");
  const [selectedPhase, setSelectedPhase] = useState<PhaseKey>("discover");
  const [newField, setNewField] = useState<Record<string, string>>({});
  const workType = value.workTypes.find((item) => item.workTypeKey === selectedType) ?? value.workTypes[0];
  const phase = workType?.phases.find((item) => item.key === selectedPhase);
  const update = (change: (draft: PublishedPhaseContract) => void) => { const draft = structuredClone(value); change(draft); onChange(draft); };
  const componentAt = (draft: PublishedPhaseContract, key: string) => draft.workTypes.find((item) => item.workTypeKey === workType.workTypeKey)!.phases.find((item) => item.key === selectedPhase)!.components.find((item) => item.key === key)!;
  if (!workType || !phase) return <p>Phase contract unavailable.</p>;
  return <section className="d5o-phase-editor" aria-label="D5O phase form contract">
    <div className="d5o-phase-editor-heading"><div><strong>Structured phase form contract</strong><span>Fields and required register columns are published with this version. Bound facts, decision guards and database authority cannot be changed here.</span></div></div>
    <div className="d5o-phase-editor-tabs" role="group" aria-label="Work Type">{value.workTypes.map((item) => <button type="button" key={item.workTypeKey} aria-pressed={workType.workTypeKey === item.workTypeKey} onClick={() => setSelectedType(item.workTypeKey)}>{item.workTypeLabel}</button>)}</div>
    <div className="d5o-phase-editor-tabs" role="group" aria-label="Phase">{phaseKeys.map((key) => <button type="button" key={key} aria-pressed={selectedPhase === key} onClick={() => setSelectedPhase(key)}>{key}</button>)}</div>
    {selectedPhase !== "discover" && selectedPhase !== "define" ? <p className="d5o-phase-editor-preview-note">Structured solution, verification and handoff entries use this published form version. Packages, crew, execution, evidence and lifecycle actions remain on their existing Work Record surfaces. Authoritative decisions stay with the server command contract.</p> : null}
    <label>Phase purpose<input value={phase.purpose} maxLength={240} onChange={(event) => update((draft) => { draft.workTypes.find((item) => item.workTypeKey === workType.workTypeKey)!.phases.find((item) => item.key === selectedPhase)!.purpose = event.target.value; })} /></label>
    <div className="d5o-phase-editor-components">{phase.components.map((item) => <article key={item.key}>
      <small>{item.kind.replaceAll("_", " ")} · {item.key}</small>
      <label>Section label<input value={item.label} maxLength={120} onChange={(event) => update((draft) => { componentAt(draft, item.key).label = event.target.value; })} /></label>
      <label>Guidance<input value={item.help} maxLength={500} onChange={(event) => update((draft) => { componentAt(draft, item.key).help = event.target.value; })} /></label>
      {item.fields?.length ? <div className="d5o-phase-editor-fields"><strong>Structured fields</strong>{item.fields.map((field) => <div key={field.key} className="d5o-phase-editor-field"><label>{field.key}<input value={field.label} maxLength={120} onChange={(event) => update((draft) => { componentAt(draft, item.key).fields!.find((entry) => entry.key === field.key)!.label = event.target.value; })} /></label><label className="d5o-phase-editor-check"><input type="checkbox" checked={field.required} disabled={item.kind !== "item_register"} onChange={(event) => update((draft) => { const component = componentAt(draft, item.key); component.fields!.find((entry) => entry.key === field.key)!.required = event.target.checked; for (const rule of component.rules ?? []) if (rule.operator === "rows_complete") rule.fields = component.fields!.filter((entry) => entry.required).map((entry) => entry.key); })} /> Required for review</label></div>)}{item.kind === "item_register" ? <div className="d5o-phase-editor-add"><input aria-label={`New ${item.label} field`} value={newField[item.key] ?? ""} maxLength={80} placeholder="New field name" onChange={(event) => setNewField((current) => ({ ...current, [item.key]: event.target.value }))} /><button type="button" disabled={!newField[item.key]?.trim()} onClick={() => { const label = newField[item.key]?.trim() ?? ""; const key = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""); if (key.length < 2 || item.fields?.some((field) => field.key === key)) return; update((draft) => { const component = componentAt(draft, item.key); component.fields!.push({ key, label, kind: "text", required: true }); for (const rule of component.rules ?? []) if (rule.operator === "rows_complete") rule.fields = component.fields!.filter((entry) => entry.required).map((entry) => entry.key); }); setNewField((current) => ({ ...current, [item.key]: "" })); }}>Add field</button></div> : null}</div> : null}
      {(item.rules ?? []).map((rule) => <label key={rule.key}>Review guidance · {rule.key}<input value={rule.message} maxLength={500} onChange={(event) => update((draft) => { componentAt(draft, item.key).rules!.find((entry) => entry.key === rule.key)!.message = event.target.value; })} /></label>)}
    </article>)}</div>
  </section>;
}
