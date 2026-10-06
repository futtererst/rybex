import type { PhaseComponent } from "./phase-configuration";
import styles from "./DefineWorkspace.module.css";

type RegisterRow = Record<string, string>;

export function DefinitionRegister({ component, rows, disabled, onChange }: {
  component: PhaseComponent;
  rows: RegisterRow[];
  disabled: boolean;
  onChange: (rows: RegisterRow[]) => void;
}) {
  const fields = component.fields ?? [];
  if (!fields.length) return null;
  return <section className={styles.register} aria-label={component.label}>
    <header><div><strong>{component.label}</strong><p>{component.help}</p></div><span>{rows.length} item{rows.length === 1 ? "" : "s"}</span></header>
    {rows.map((row, index) => <div className={styles.registerRow} key={row.id ?? index}>
      <div className={styles.registerFields}>{fields.map((field) => <label key={field.key}><span>{field.label}{field.required ? " *" : ""}</span>{field.kind === "select" ? <select value={row[field.key] ?? ""} disabled={disabled} onChange={(event) => onChange(rows.map((item, rowIndex) => rowIndex === index ? { ...item, [field.key]: event.target.value } : item))}><option value="">Select</option>{field.options?.map((option) => <option key={option}>{option}</option>)}</select> : <input type={field.kind} value={row[field.key] ?? ""} disabled={disabled} onChange={(event) => onChange(rows.map((item, rowIndex) => rowIndex === index ? { ...item, [field.key]: event.target.value } : item))} />}</label>)}</div>
      {!disabled ? <button type="button" className={styles.removeRow} aria-label={`Remove ${component.label} item ${index + 1}`} onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))}>Remove</button> : null}
    </div>)}
    {!disabled ? <button type="button" className={styles.addRow} onClick={() => onChange([...rows, { id: crypto.randomUUID(), ...Object.fromEntries(fields.map((field) => [field.key, ""])) }])}>+ Add {component.label.toLowerCase()} item</button> : null}
    {!rows.length ? <p className={styles.registerEmpty}>No items recorded. Add a structured row to establish this review requirement.</p> : null}
  </section>;
}
