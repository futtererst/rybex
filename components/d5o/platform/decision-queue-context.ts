export type DecisionQueueContext = {
  blockers: string[];
  decision: string;
  profile: string;
  target: "Overview" | "Lifecycle" | "Develop" | "Design" | "Deploy" | "Operate" | "Plan" | "Readiness" | "Execution" | "Issues & changes" | "Evidence" | "Commercial" | "Handoff" | "Lifecycle Value" | "History";
  pinned: boolean;
};
