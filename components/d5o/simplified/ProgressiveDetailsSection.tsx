import type { ReactNode } from "react";
import { ProgressiveDetails } from "@/components/d5o/ProgressiveDetails";

type ProgressiveDetailsSectionProps = {
  title: string;
  summary: string;
  children: ReactNode;
};

export function ProgressiveDetailsSection({ title, summary, children }: ProgressiveDetailsSectionProps) {
  return (
    <div data-qa="collapsed-details" id="details-records">
      <ProgressiveDetails title={title} summary={summary} severity="info">
        {children}
      </ProgressiveDetails>
    </div>
  );
}
