import {
  recommendationLabels,
  recommendationTone,
  riskLevelLabels,
  riskLevelTone
} from "@/lib/d5o/opportunity-config";
import { chipClass } from "@/lib/d5o/presentation";
import { dimensionLabels, type GoNoGoResult } from "@/lib/d5o/go-no-go";

type GoNoGoScoreCardProps = {
  result: GoNoGoResult;
  compact?: boolean;
};

export function GoNoGoScoreCard({ result, compact = false }: GoNoGoScoreCardProps) {
  return (
    <article className="score-card">
      <div className="score-card-header">
        <div>
          <p className="eyebrow">Go/No-Go Score</p>
          <h3>{result.totalScore}/100</h3>
        </div>
        <div className="score-chip-stack">
          <span className={chipClass(recommendationTone[result.recommendation])}>
            {recommendationLabels[result.recommendation]}
          </span>
          <span className={chipClass(riskLevelTone[result.riskLevel])}>
            {riskLevelLabels[result.riskLevel]} Risk
          </span>
        </div>
      </div>

      <div className="score-dimensions">
        {result.dimensionScores.map((dimension) => (
          <div className="score-dimension" key={dimension.id}>
            <div className="status-row">
              <strong>{dimensionLabels[dimension.id]}</strong>
              <span className="muted">{dimension.score}/5</span>
            </div>
            <div className="progress-track">
              <div
                className="progress-bar"
                style={{ width: `${(dimension.score / 5) * 100}%` }}
              />
            </div>
            {!compact && <p>{dimension.rationale}</p>}
          </div>
        ))}
      </div>

      {!compact && (
        <div className="score-detail-grid">
          <ScoreList title="Strengths" items={result.strengths} />
          <ScoreList title="Concerns" items={result.concerns} />
          <ScoreList title="Required Mitigations" items={result.requiredMitigations} />
          <ScoreList title="Required Approvals" items={result.requiredApprovals} />
        </div>
      )}
    </article>
  );
}

function ScoreList({ title, items }: { title: string; items: string[] }) {
  return (
    <section>
      <h4>{title}</h4>
      <ul className="plain-list">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
