import { closeoutRequirementCategoryLabels, closeoutRequirementStatusLabels, closeoutRequirementStatusTone, closeoutSourceModuleLabels } from "@/lib/d5o/closeout-config";
import { chipClass, dateLabel } from "@/lib/d5o/presentation";
import type { CloseoutRequirement } from "@/lib/d5o/types";

export function CloseoutRequirementTracker({ requirements }: { requirements: CloseoutRequirement[] }) {
  const open = requirements.filter((item) => !["accepted", "waived", "archived"].includes(item.status));

  return (
    <section className="control-list">
      <h3>Missing document / evidence list</h3>
      {open.length === 0 ? (
        <p className="ready-callout">All required closeout documents are accepted or archived.</p>
      ) : (
        <ul className="record-list">
          {open.slice(0, 12).map((item, index) => (
            <li key={`closeout-requirement-${item.packageId}-${item.id}-${index}`}>
              <div>
                <strong>{item.title}</strong>
                <span>{closeoutRequirementCategoryLabels[item.category]} | {closeoutSourceModuleLabels[item.sourceModule]} | due {dateLabel(item.dueDate)}</span>
              </div>
              <span className={chipClass(closeoutRequirementStatusTone[item.status])}>{closeoutRequirementStatusLabels[item.status]}</span>
              <p>{item.nextAction}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
