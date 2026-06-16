import type { ReactNode } from "react";
import { ProgressiveDetails } from "@/components/d5o/ProgressiveDetails";

type CollapsedDetailsProps = {
  title: string;
  summary: string;
  count?: number;
  children: ReactNode;
};

export function CollapsedDetails({ title, summary, count, children }: CollapsedDetailsProps) {
  return (
    <div data-qa="collapsed-details" id="details-records" tabIndex={-1}>
      <ProgressiveDetails count={count} severity="info" summary={summary} title={title}>
        {children}
      </ProgressiveDetails>
    </div>
  );
}
