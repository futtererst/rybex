import { closeoutRequirementStatusLabels, closeoutRequirementStatusTone } from "@/lib/d5o/closeout-config";
import { chipClass } from "@/lib/d5o/presentation";
import type { CloseoutRequirement, WarrantyRecord } from "@/lib/d5o/types";

export function ArchivePackagePanel({
  requirements,
  warranties
}: {
  requirements: CloseoutRequirement[];
  warranties: WarrantyRecord[];
}) {
  const archiveItems = requirements.filter((item) => item.category === "archive");

  return (
    <section className="control-list">
      <h3>Archive package status</h3>
      <ul className="record-list">
        {[...archiveItems, ...warranties].map((item, index) => (
          <li key={`archive-${"vendorOrSupplier" in item ? "warranty" : "requirement"}-${item.id}-${index}`}>
            <div>
              <strong>{item.title}</strong>
              <span>{"vendorOrSupplier" in item ? item.vendorOrSupplier : "Archive requirement"}</span>
            </div>
            <span className={chipClass(closeoutRequirementStatusTone[item.status])}>{closeoutRequirementStatusLabels[item.status]}</span>
            <p>{item.nextAction}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
