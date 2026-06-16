import { chipClass, dateLabel } from "@/lib/d5o/presentation";
import { lessonCategoryLabels, lessonStatusLabels, optimizeSeverityLabels, optimizeSeverityTone, optimizeStatusTone, targetModuleLabels } from "@/lib/d5o/optimize-config";
import type { LessonLearned } from "@/lib/d5o/types";

export function LessonsLearnedCard({ lesson }: { lesson: LessonLearned }) {
  return (
    <article className="project-card">
      <div className="card-title-row">
        <div>
          <h3>{lesson.title}</h3>
          <p>{lesson.projectName} | {lessonCategoryLabels[lesson.category]}</p>
        </div>
        <span className={chipClass(optimizeSeverityTone[lesson.severity])}>{optimizeSeverityLabels[lesson.severity]}</span>
      </div>
      <p>{lesson.impact}</p>
      <dl className="card-meta">
        <div><dt>Status</dt><dd><span className={chipClass(optimizeStatusTone[lesson.status])}>{lessonStatusLabels[lesson.status]}</span></dd></div>
        <div><dt>Owner</dt><dd>{lesson.owner}</dd></div>
        <div><dt>Due</dt><dd>{dateLabel(lesson.dueDate)}</dd></div>
        <div><dt>Updates</dt><dd>{targetModuleLabels[lesson.targetModule]}</dd></div>
      </dl>
      <p className="missing-callout">{lesson.recommendedChange}</p>
    </article>
  );
}
