import type { RFI } from "@/lib/d5o/types";

export function RfiImpactPanel({ rfis }: { rfis: RFI[] }) {
  const impactRfis = rfis.filter((rfi) => rfi.costImpact || rfi.scheduleImpact);

  return (
    <section className="control-list">
      <h3>RFI Impact Review</h3>
      {impactRfis.length > 0 ? (
        <ul className="plain-list">
          {impactRfis.map((rfi) => (
            <li key={rfi.id}>
              {rfi.rfiNumber}: {rfi.scheduleImpact ? "schedule" : ""} {rfi.costImpact ? "cost" : ""} impact | {rfi.linkedChangeEventIds.length} linked change(s)
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No current RFI cost or schedule impacts.</p>
      )}
    </section>
  );
}
