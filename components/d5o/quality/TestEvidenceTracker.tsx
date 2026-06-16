import { chipClass } from "@/lib/d5o/presentation";
import { qualityStatusLabels, qualityStatusTone, testTypeLabels } from "@/lib/d5o/quality-config";
import type { TestRecord } from "@/lib/d5o/types";

export function TestEvidenceTracker({ tests }: { tests: TestRecord[] }) {
  return (
    <section className="control-list">
      <h3>Test evidence tracker</h3>
      <ul className="record-list">
        {tests.map((test) => (
          <li key={test.id}>
            <div>
              <strong>{test.title}</strong>
              <span>{test.projectName} | {testTypeLabels[test.testType]}</span>
            </div>
            <span className={chipClass(qualityStatusTone[test.status])}>{qualityStatusLabels[test.status]}</span>
            <p>{test.nextAction}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
