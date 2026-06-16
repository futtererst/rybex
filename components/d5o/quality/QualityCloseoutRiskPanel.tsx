import type { PunchItem, QualityDeficiency, TestRecord } from "@/lib/d5o/types";

export function QualityCloseoutRiskPanel({
  deficiencies,
  tests,
  punchItems
}: {
  deficiencies: QualityDeficiency[];
  tests: TestRecord[];
  punchItems: PunchItem[];
}) {
  const evidenceGaps = [
    ...deficiencies.filter((item) => item.closeoutImpact && !["closed", "verified"].includes(item.status)).map((item) => item.title),
    ...tests.filter((item) => item.requiredForCloseout && (item.attachments.length === 0 || ["failed", "overdue", "blocked"].includes(item.status))).map((item) => item.title),
    ...punchItems.filter((item) => item.closeoutImpact && !["closed", "verified"].includes(item.status)).map((item) => item.title)
  ];

  return (
    <section className="control-list">
      <h3>Closeout evidence risk</h3>
      {evidenceGaps.length === 0 ? (
        <p className="ready-callout">Quality evidence is tracking toward D5 acceptance.</p>
      ) : (
        <ul className="plain-list">
          {evidenceGaps.slice(0, 8).map((item) => <li key={item}>{item}</li>)}
        </ul>
      )}
    </section>
  );
}
