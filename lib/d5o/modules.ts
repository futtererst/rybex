import type { D5OPhaseId } from "./types";

export type RybexModule = {
  slug: string;
  label: string;
  href: string;
  purpose: string;
  relatedPhases: D5OPhaseId[];
  plannedCapabilities: string[];
  comingNext: string;
};

export const commandCenterNavItem = {
  label: "Command Center",
  href: "/command-center"
};

export const rybexModules: RybexModule[] = [
  {
    slug: "pipeline",
    label: "Pipeline",
    href: "/pipeline",
    purpose:
      "Manage bid intake, qualification, pursuit discipline, and go/no-go decisions before estimating effort is committed.",
    relatedPhases: ["discover", "define"],
    plannedCapabilities: [
      "Opportunity intake",
      "GC/client fit scoring",
      "Risk screen and pursuit approval",
      "Bid calendar and proposal readiness"
    ],
    comingNext: "Recommended next build: Pipeline / Opportunity Intake with go/no-go scoring."
  },
  {
    slug: "projects",
    label: "Projects",
    href: "/projects",
    purpose:
      "Provide the project system of record across scope, baseline, phase gates, risks, decisions, and operating controls.",
    relatedPhases: ["define", "prepare", "deliver", "close", "optimize"],
    plannedCapabilities: [
      "Project setup",
      "D5O gate history",
      "Owner and crew assignment",
      "Risk, issue, and decision logs"
    ],
    comingNext: "Project detail pages will reuse the D5O gate and health card patterns."
  },
  {
    slug: "mobilization",
    label: "Mobilization",
    href: "/mobilization",
    purpose:
      "Clear the conditions required for crews to mobilize with access, permits, safety controls, materials, equipment, and work packages ready.",
    relatedPhases: ["prepare"],
    plannedCapabilities: [
      "Mobilization checklist",
      "Permit and access tracker",
      "Crew, equipment, and material readiness",
      "Kickoff package control"
    ],
    comingNext: "Mobilization will build from the D3 readiness gate."
  },
  {
    slug: "field-execution",
    label: "Field Execution",
    href: "/field-execution",
    purpose:
      "Control field production, daily reporting, delays, constraints, and commercial documentation during execution.",
    relatedPhases: ["deliver"],
    plannedCapabilities: [
      "Daily reports",
      "Production tracking",
      "Delay and constraint log",
      "Crew-level field package status"
    ],
    comingNext: "Field Execution will connect daily reports to D4 gate readiness."
  },
  {
    slug: "safety",
    label: "Safety",
    href: "/safety",
    purpose:
      "Track safety plans, JHAs, observations, incidents, and corrective actions tied to field readiness and execution.",
    relatedPhases: ["prepare", "deliver", "close"],
    plannedCapabilities: [
      "Safety plans and JHAs",
      "Corrective action tracking",
      "Incident and observation logs",
      "Safety closeout evidence"
    ],
    comingNext: "Safety records will become first-class D3 and D4 gate artifacts."
  },
  {
    slug: "quality",
    label: "Quality",
    href: "/quality",
    purpose:
      "Manage inspection plans, deficiencies, rework, test results, and acceptance evidence.",
    relatedPhases: ["prepare", "deliver", "close"],
    plannedCapabilities: [
      "Quality inspection plans",
      "Deficiency and rework logs",
      "Test result tracking",
      "Acceptance evidence control"
    ],
    comingNext: "Quality will connect deficiencies to closeout readiness."
  },
  {
    slug: "rfis-submittals",
    label: "RFIs / Submittals",
    href: "/rfis-submittals",
    purpose:
      "Protect schedule and scope clarity through accountable RFI, submittal, and response tracking.",
    relatedPhases: ["define", "prepare", "deliver", "close"],
    plannedCapabilities: [
      "RFI log",
      "Submittal log",
      "Overdue response escalation",
      "Schedule-critical linkage"
    ],
    comingNext: "RFI and submittal logs will feed operating action items."
  },
  {
    slug: "changes",
    label: "Changes",
    href: "/changes",
    purpose:
      "Protect entitlement and margin through change notice, pricing, backup, submission, and approval controls.",
    relatedPhases: ["define", "deliver", "close"],
    plannedCapabilities: [
      "Change event log",
      "Notice deadline tracking",
      "Cost backup readiness",
      "Approved change billing support"
    ],
    comingNext: "Change Control will prioritize notice deadlines and cost backup gaps."
  },
  {
    slug: "billing",
    label: "Billing",
    href: "/billing",
    purpose:
      "Support pay applications, approved changes, stored materials, final billing, retainage, and backup requirements.",
    relatedPhases: ["define", "deliver", "close"],
    plannedCapabilities: [
      "Pay application calendar",
      "Billing backup checklist",
      "Approved change capture",
      "Retainage and final billing status"
    ],
    comingNext: "Billing will use closeout and change data to surface collection risk."
  },
  {
    slug: "closeout",
    label: "Closeout",
    href: "/closeout",
    purpose:
      "Drive punch, as-builts, test results, warranties, photo evidence, acceptance, final billing, and retainage release.",
    relatedPhases: ["close"],
    plannedCapabilities: [
      "Closeout package tracker",
      "Punch and deficiency aging",
      "Acceptance evidence",
      "Final billing and retainage readiness"
    ],
    comingNext: "Closeout will build directly from D5 gate artifacts."
  },
  {
    slug: "reports",
    label: "Reports",
    href: "/reports",
    purpose:
      "Give leadership repeatable views into margin, schedule, safety, quality, change exposure, and operating learning.",
    relatedPhases: ["discover", "define", "prepare", "deliver", "close", "optimize"],
    plannedCapabilities: [
      "Executive operating reports",
      "Phase-gate readiness reporting",
      "Risk and change exposure views",
      "Lessons-learned summaries"
    ],
    comingNext: "Reports will formalize the Command Center views into reusable operating reports."
  },
  {
    slug: "admin",
    label: "Admin",
    href: "/admin",
    purpose:
      "Manage roles, service lines, gate templates, operating standards, and future data integrations.",
    relatedPhases: ["discover", "define", "prepare", "deliver", "close", "optimize"],
    plannedCapabilities: [
      "Role and permission setup",
      "D5O template administration",
      "Service line configuration",
      "Integration readiness"
    ],
    comingNext: "Admin will support configuration after core workflows are established."
  }
];

export const primaryNavItems = [commandCenterNavItem, ...rybexModules];

export const moduleMap = Object.fromEntries(
  rybexModules.map((module) => [module.slug, module])
) as Record<string, RybexModule | undefined>;
