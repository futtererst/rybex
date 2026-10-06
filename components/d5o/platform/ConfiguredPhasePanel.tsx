import type { WorkRecord } from "./work-types";
import { evaluateRule, type PhaseDefinition, type WorkTypeConfiguration } from "./phase-configuration";
import styles from "./ConfiguredPhasePanel.module.css";

export function ConfiguredPhasePanel({ config, phase, work, compact = false }: { config: WorkTypeConfiguration; phase: PhaseDefinition; work?: WorkRecord; compact?: boolean }) {
  const requirements = phase.components.flatMap((item) => (item.rules ?? []).map((rule) => ({ component: item, rule, met: work ? evaluateRule(work, rule) : false })));
  const missing = work ? requirements.filter((item) => !item.met) : [];
  return <section className={`${styles.panel} ${compact ? styles.compact : ""}`} aria-label={`${phase.label} configured requirements`}>
    <header className={styles.header}><div><p>CONFIGURED WORK TYPE · {config.version}</p><h3>{phase.label} · {config.workTypeLabel}</h3><span>{phase.purpose}</span></div><b>{phase.gate}</b></header>
    {work && missing.length ? <div className={styles.alert} role="status"><strong>{missing.length} configured requirement{missing.length === 1 ? "" : "s"} open</strong><span>{missing.map(({ rule }) => rule.message).join(" ")}</span></div> : null}
    {work && !missing.length && requirements.length ? <div className={styles.ready}>Configured requirements shown here are met. Authoritative approval still requires the governed command.</div> : null}
    <div className={styles.items}>{phase.components.map((item) => {
      const checks = requirements.filter((entry) => entry.component.key === item.key);
      const unmet = work && checks.some((entry) => !entry.met);
      return <article key={item.key} className={unmet ? styles.unmet : ""}><div><small>{item.kind.replaceAll("_", " ")} · {item.source}</small><strong>{item.label}</strong><span>{item.help}</span></div><em>{!work ? `${checks.length} rule${checks.length === 1 ? "" : "s"}` : !checks.length ? "Context" : unmet ? "Action required" : "Satisfied"}</em></article>;
    })}</div>
    <footer>{config.templatePack} · {config.version === "prototype-v1" ? "Legacy reference layout; this Work Record predates published phase-form pinning." : `Published phase-form version ${config.version}. This browser review is not the authoritative database gate decision.`}</footer>
  </section>;
}
