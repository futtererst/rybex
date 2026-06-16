import { LessonsLearnedCard } from "./LessonsLearnedCard";
import type { LessonLearned } from "@/lib/d5o/types";

export function LessonsLearnedRegister({ lessons }: { lessons: LessonLearned[] }) {
  return (
    <div className="project-detail-grid">
      {lessons.map((lesson) => (
        <LessonsLearnedCard key={lesson.id} lesson={lesson} />
      ))}
    </div>
  );
}
