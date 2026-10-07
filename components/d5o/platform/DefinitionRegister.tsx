"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import type { PhaseComponent } from "./phase-configuration";
import styles from "./DefineWorkspace.module.css";

type RegisterRow = Record<string, string>;

export function DefinitionRegister({ component, rows, disabled, onChange, link }: {
  component: PhaseComponent;
  rows: RegisterRow[];
  disabled: boolean;
  onChange: (rows: RegisterRow[]) => void;
  link?: { key: string; label: string; options: Array<{ id: string; label: string }> };
}) {
  const fields = component.fields ?? [];
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [draft, setDraft] = useState<RegisterRow>({});
  if (!fields.length) return null;
  function open(index: number | "new") {
    setDraft(index === "new" ? { id: crypto.randomUUID() } : { id: rows[index].id ?? crypto.randomUUID(), ...rows[index] });
    setEditing(index);
  }
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (fields.some((field) => field.required && !String(draft[field.key] ?? "").trim())) return;
    onChange(editing === "new" ? [...rows, draft] : rows.map((row, index) => index === editing ? draft : row));
    setEditing(null);
  }
  return <section className={styles.register} aria-label={component.label}>
    <header><div><strong>{component.label}</strong><p>{component.help}</p></div><span>{rows.length} {rows.length === 1 ? "item" : "items"}</span></header>
    {rows.length ? <div className={styles.registerTable}><div className={styles.registerTableHead} style={{ gridTemplateColumns: `repeat(${fields.length + (link ? 1 : 0)},minmax(0,1fr)) 70px` }}>{fields.map((field) => <span key={field.key}>{field.label}</span>)}{link ? <span>{link.label}</span> : null}<span>Action</span></div>
      {rows.map((row, index) => <div className={styles.registerTableRow} style={{ gridTemplateColumns: `repeat(${fields.length + (link ? 1 : 0)},minmax(0,1fr)) 70px` }} key={row.id ?? index}>{fields.map((field) => <span key={field.key} data-label={field.label}>{row[field.key] || "Not set"}</span>)}{link ? <span data-label={link.label}>{link.options.find((option) => option.id === row[link.key])?.label ?? "Unlinked"}</span> : null}<button type="button" className="d5o-outline" onClick={() => open(index)}>{disabled ? "View" : "Edit"}</button></div>)}
    </div> : <p className={styles.registerEmpty}>No items recorded. Add the first item to establish this review requirement.</p>}
    {!disabled ? <button type="button" className={styles.addRow} onClick={() => open("new")}>+ Add {component.label.toLowerCase().replace(/s$/, "")}</button> : null}
    {editing !== null ? <div className={styles.drawerBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) setEditing(null); }}><aside className={styles.drawer} role="dialog" aria-modal="true" aria-label={`${editing === "new" ? "Add" : "Review"} ${component.label}`}>
      <header><div><p className={styles.kicker}>DEFINE · {component.label.toUpperCase()}</p><h3>{editing === "new" ? `Add ${component.label.toLowerCase().replace(/s$/, "")}` : `${disabled ? "View" : "Edit"} ${component.label.toLowerCase().replace(/s$/, "")}`}</h3><p>{component.help}</p></div><button type="button" className="d5o-outline" onClick={() => setEditing(null)} aria-label="Close drawer">×</button></header>
      <form onSubmit={save} className={styles.drawerForm}>{fields.map((field) => <label key={field.key}>{field.label}{field.required ? " *" : ""}{field.kind === "select" ? <select value={draft[field.key] ?? ""} disabled={disabled} required={field.required} onChange={(event) => setDraft({ ...draft, [field.key]: event.target.value })}><option value="">Select</option>{field.options?.map((option) => <option key={option}>{option}</option>)}</select> : <input type={field.kind} value={draft[field.key] ?? ""} disabled={disabled} required={field.required} onChange={(event) => setDraft({ ...draft, [field.key]: event.target.value })} />}</label>)}{link ? <label>{link.label} *<select value={draft[link.key] ?? ""} disabled={disabled} required onChange={(event) => setDraft({ ...draft, [link.key]: event.target.value })}><option value="">Select source</option>{link.options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label> : null}<p className={styles.drawerHelp}>Saved on this Define revision and checked again before review.</p><footer>{!disabled && editing !== "new" ? <button type="button" className="d5o-outline" onClick={() => { onChange(rows.filter((_, index) => index !== editing)); setEditing(null); }}>Remove</button> : null}<button type="button" className="d5o-outline" onClick={() => setEditing(null)}>Close</button>{!disabled ? <button type="submit" className="d5o-primary">Save item</button> : null}</footer></form>
    </aside></div> : null}
  </section>;
}
