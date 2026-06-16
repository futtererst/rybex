export type PilotReadinessRating =
  | "not_started"
  | "concept_scaffold"
  | "demo_only"
  | "pilot_candidate"
  | "controlled_pilot_ready"
  | "production_ready";

export type PilotReadinessScore = {
  area: string;
  score: 0 | 1 | 2 | 3 | 4 | 5;
  rating: PilotReadinessRating;
  rationale: string;
  gap: string;
  nextAction: string;
};

export type PilotReadinessSummary = {
  averageScore: number;
  currentMaturity: string;
  controlledPilotRecommendation: string;
  productionReadinessStatus: string;
  recommendedPilotScope: string;
};

const scorecard: PilotReadinessScore[] = [
  {
    area: "D5O workflow coverage",
    score: 4,
    rating: "controlled_pilot_ready",
    rationale: "All D5O phases are represented and tied to workflow language, gates, actions, evidence, and Optimize learning.",
    gap: "Coverage still needs validation on real internal project records.",
    nextAction: "Pilot with 1-2 internal projects and track where real work does not fit the current model."
  },
  {
    area: "UX clarity",
    score: 4,
    rating: "controlled_pilot_ready",
    rationale: "The simplified stage/gate/action/evidence pattern and visual QA review make the demo understandable.",
    gap: "Lower-page density and edge-case workflows may still need simplification after user testing.",
    nextAction: "Use role-based pilot scripts and capture friction by route."
  },
  {
    area: "Role clarity",
    score: 4,
    rating: "controlled_pilot_ready",
    rationale: "Role journeys, role context, RBAC foundations, and permission checks are documented and visible.",
    gap: "There is no full role-specific workspace or production login flow.",
    nextAction: "Validate each role's first 60 seconds during the controlled pilot."
  },
  {
    area: "Workflow transaction execution",
    score: 3,
    rating: "pilot_candidate",
    rationale: "Local workflow actions work and a narrow Supabase workflow transaction write pilot has been verified.",
    gap: "Only workflow transactions are writable; full workflow side effects and production approvals are not complete.",
    nextAction: "Pilot selected workflow actions with clear local/database mode boundaries."
  },
  {
    area: "Supabase persistence",
    score: 3,
    rating: "pilot_candidate",
    rationale: "Core, D1/D2, workflow transaction, evidence, and security schema scaffolds exist with read/write pilots.",
    gap: "Broad module persistence is not enabled and seed mode remains the safe default.",
    nextAction: "Do not expand persistence until workflow transaction pilot results are reviewed."
  },
  {
    area: "Auth/RBAC",
    score: 3,
    rating: "pilot_candidate",
    rationale: "Demo auth mode, user resolution, RBAC permissions, and workflow transaction permission enforcement exist.",
    gap: "Production login, invitations, external users, and active RLS are not enabled.",
    nextAction: "Implement Supabase Auth/session resolution before any live-data pilot."
  },
  {
    area: "Evidence handling",
    score: 3,
    rating: "pilot_candidate",
    rationale: "Evidence requirements are modeled, derived, displayed, and locally actionable.",
    gap: "Production file governance and hard access controls are not complete.",
    nextAction: "Use evidence tracking in pilot, but avoid sensitive production documents until storage security is approved."
  },
  {
    area: "Upload/storage",
    score: 2,
    rating: "demo_only",
    rationale: "A narrow Supabase Storage evidence upload pilot and private bucket scaffold exist.",
    gap: "Signed URLs, active storage policies, malware scanning, retention, and production document controls are missing.",
    nextAction: "Treat upload as an isolated pilot only, not production document management."
  },
  {
    area: "Notifications/escalations",
    score: 2,
    rating: "demo_only",
    rationale: "In-app notifications and escalation queues are derived from workflows and evidence.",
    gap: "There is no persisted notification state, scheduler, email, SMS, Teams, Slack, or push delivery.",
    nextAction: "Use in-app alerts for pilot review only."
  },
  {
    area: "RLS/security",
    score: 1,
    rating: "concept_scaffold",
    rationale: "Security design, RLS helper functions, and storage policy scaffolds exist.",
    gap: "Broad RLS and production file access policies are intentionally not enabled.",
    nextAction: "Complete human security review before enabling table or storage policies."
  },
  {
    area: "Reporting/analytics",
    score: 2,
    rating: "demo_only",
    rationale: "Command Center, module views, Optimize, and readiness data provide deterministic operating insight.",
    gap: "Reporting is not built on durable live transactions, views, scheduled packs, or exports.",
    nextAction: "After transaction persistence, define the first weekly operations report pack."
  },
  {
    area: "Admin/system readiness",
    score: 4,
    rating: "controlled_pilot_ready",
    rationale: "Admin shows mode, verification, security, persistence, evidence, notification, and readiness status.",
    gap: "It remains a readiness page, not a production admin console.",
    nextAction: "Use Admin as the pilot control point and issue triage reference."
  },
  {
    area: "Integration readiness",
    score: 1,
    rating: "concept_scaffold",
    rationale: "Integration strategy is documented, but no external system integration is active.",
    gap: "No accounting, Procore, Autodesk, identity provider, DocuSign, Teams, or email integration exists.",
    nextAction: "Defer integrations until internal workflow and data model are validated."
  },
  {
    area: "Deployment readiness",
    score: 3,
    rating: "pilot_candidate",
    rationale: "Build, lint, audit, smoke, visual capture, demo package, and deployment docs exist.",
    gap: "Production environment separation, monitoring, backups, and incident response are not complete.",
    nextAction: "Use local/private demo deployment only until production operations are approved."
  },
  {
    area: "Operational support readiness",
    score: 2,
    rating: "demo_only",
    rationale: "Demo scripts, pilot scripts, verification commands, and support guidance are documented.",
    gap: "No support runbook, SLAs, production owner model, or incident response cadence exists.",
    nextAction: "Assign pilot support owner and weekly review cadence before launch."
  }
];

const blockers = [
  "Production RLS and storage access policies are scaffolded but not enabled.",
  "Production auth/login and workspace membership resolution are not live.",
  "Broad module record persistence and write workflows are not implemented.",
  "Evidence upload remains a narrow pilot; production document security is not complete.",
  "External notifications and escalation delivery are not enabled.",
  "Operational monitoring, backup, and incident response are not production-ready."
];

const recommendations = [
  "Approve only a controlled internal pilot with 1-2 low-risk Rybex projects.",
  "Keep seed/local fallback available for demos and recovery.",
  "Use workflow actions, evidence requirements, and in-app escalation as the pilot focus.",
  "Do not allow external GC/client access in the first pilot.",
  "Do not store sensitive production documents until storage security and RLS are approved.",
  "Review pilot findings before expanding persistence, auth, uploads, or notifications."
];

export function getPilotReadinessScorecard() {
  return scorecard;
}

export function getPilotReadinessSummary(): PilotReadinessSummary {
  const total = scorecard.reduce((sum, item) => sum + item.score, 0);
  const averageScore = Math.round((total / scorecard.length) * 10) / 10;

  return {
    averageScore,
    currentMaturity: "Controlled internal pilot candidate",
    controlledPilotRecommendation: "Proceed only with a limited internal pilot after human approval of security, data, and support boundaries.",
    productionReadinessStatus: "Not production-ready",
    recommendedPilotScope: "1-2 internal projects, limited users, no external GC access, in-app notifications only, and no sensitive production documents unless storage security is fully approved."
  };
}

export function getPilotBlockers() {
  return blockers;
}

export function getPilotRecommendations() {
  return recommendations;
}
