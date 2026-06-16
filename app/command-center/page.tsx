import Link from "next/link";
import { D5OPhaseGate } from "@/components/d5o/D5OPhaseGate";
import { D5OPhaseSummary } from "@/components/d5o/D5OPhaseSummary";
import { OperatingActionItem } from "@/components/d5o/OperatingActionItem";
import { ActionWorkspaceLayout, CollapsedDetails } from "@/components/d5o/end-user";
import { EscalationQueue, NotificationPanel, NotificationSummaryStrip } from "@/components/d5o/notifications";
import { PageHeader } from "@/components/d5o/PageHeader";
import { ProgressiveDetails } from "@/components/d5o/ProgressiveDetails";
import { ProjectHealthCard } from "@/components/d5o/ProjectHealthCard";
import { StageGateSummary } from "@/components/d5o/stage-gates/StageGateSummary";
import { DecisionQueue } from "@/components/d5o/workflow/DecisionQueue";
import { NextBestAction } from "@/components/d5o/workflow/NextBestAction";
import { WorkflowActionCard } from "@/components/d5o/workflow/WorkflowActionCard";
import { WorkflowPhaseMap } from "@/components/d5o/workflow/WorkflowPhaseMap";
import { evaluateBillingControl } from "@/lib/d5o/billing-control";
import { evaluateChangeControl } from "@/lib/d5o/change-control";
import { d5oPhases } from "@/lib/d5o/config";
import { evaluateD4Gate } from "@/lib/d5o/d4-gate";
import { evaluateD5Gate } from "@/lib/d5o/d5-gate";
import { evaluateD3Gate } from "@/lib/d5o/d3-gate";
import { demoUser } from "@/lib/d5o/demo-user";
import { calculateGoNoGo } from "@/lib/d5o/go-no-go";
import { moduleImplementationStatuses } from "@/lib/d5o/implementation-status";
import { activePipelineStatuses, opportunityStatusMap } from "@/lib/d5o/opportunity-config";
import { evaluateRfiSubmittalControl } from "@/lib/d5o/rfi-submittal-control";
import { evaluateQualityControl } from "@/lib/d5o/quality-control";
import { evaluateSafetyControl } from "@/lib/d5o/safety-control";
import { evaluateOptimizeControl } from "@/lib/d5o/optimize-control";
import {
  changeEvents,
  acceptanceRecords,
  asBuiltRecords,
  billingBackupItems,
  closeoutItems,
  closeoutPackages,
  closeoutRequirements,
  commercialExposureItems,
  correctiveActions,
  dailyReports,
  decisions,
  getProjectById,
  gcPerformanceProfiles,
  improvementActions,
  issues,
  jhaRecords,
  lienWaivers,
  mobilizationPlans,
  operatingActions,
  opportunities,
  payApplications,
  productionRateRecords,
  projectPerformanceScorecards,
  punchItems,
  projects,
  qualityDeficiencies,
  qualityInspections,
  qualityRecords,
  riskLibraryItems,
  rfis,
  risks,
  safetyIncidents,
  safetyObservations,
  safetyPlans,
  safetyRecords,
  submittals,
  testRecords,
  warrantyRecords,
  lessonsLearned,
  vendorPerformanceProfiles,
  toolboxTalks,
  workPackages
} from "@/lib/d5o/seed-data";
import type { D5OPhaseId, RybexProject } from "@/lib/d5o/types";
import { compactCurrency, currency, dateLabel } from "@/lib/d5o/presentation";
import { deriveOperatingNotifications } from "@/lib/d5o/notifications";
import { deriveOperatingWorkflows } from "@/lib/d5o/workflow";
import { getEndUserWorkspaceSummary } from "@/lib/d5o/end-user/page-focus-config";

const operatingDate = "2026-06-10";

const phaseIds = d5oPhases.map((phase) => phase.id);
const activeOpportunities = opportunities.filter((opportunity) =>
  activePipelineStatuses.includes(opportunity.status)
);
const bidsDueSoon = activeOpportunities.filter(
  (opportunity) => daysUntil(opportunity.bidDueDate) <= 7
);
const awaitingGoNoGo = activeOpportunities.filter(
  (opportunity) => opportunity.status === "awaiting_go_no_go"
);
const highRiskOpportunities = activeOpportunities.filter((opportunity) =>
  ["high", "severe"].includes(calculateGoNoGo(opportunity).riskLevel)
);
const atRiskProjects = projects.filter((project) =>
  ["at_risk", "critical", "blocked", "watch"].includes(project.healthStatus)
);
const blockedMobilizations = mobilizationPlans.filter((plan) => {
  const project = projects.find((candidate) => candidate.id === plan.projectId);
  return !evaluateD3Gate(plan, project).readyBoolean;
});
const upcomingFieldStarts = mobilizationPlans
  .filter((plan) => daysUntil(plan.plannedFieldStartDate) <= 14)
  .sort((a, b) => a.plannedFieldStartDate.localeCompare(b.plannedFieldStartDate));
const openChanges = changeEvents.filter((event) => !["billed", "closed"].includes(event.status));
const rfiSubmittalControl = evaluateRfiSubmittalControl({ rfis, submittals });
const changeControl = evaluateChangeControl({ changeEvents, dailyReports });
const billingControl = evaluateBillingControl({
  payApplications,
  backupItems: billingBackupItems,
  lienWaivers,
  commercialExposure: commercialExposureItems,
  changeEvents
});
const safetyActions = correctiveActions.filter((action) =>
  action.sourceType === "safety_observation" || action.sourceType === "safety_incident"
);
const safetyControl = evaluateSafetyControl({
  safetyPlans,
  jhaRecords,
  toolboxTalks,
  observations: safetyObservations,
  incidents: safetyIncidents,
  correctiveActions: safetyActions
});
const qualityActions = correctiveActions.filter((action) =>
  action.sourceType === "quality_deficiency" || action.sourceType === "quality_inspection" || action.sourceType === "punch_item"
);
const qualityControl = evaluateQualityControl({
  inspections: qualityInspections,
  deficiencies: qualityDeficiencies,
  tests: testRecords,
  punchItems,
  correctiveActions: qualityActions
});
const d5Readiness = closeoutPackages.map((closeoutPackage) => evaluateD5Gate({
  closeoutPackage,
  project: projects.find((project) => project.id === closeoutPackage.projectId),
  requirements: closeoutRequirements,
  acceptanceRecords,
  dailyReports,
  punchItems,
  testRecords,
  qualityDeficiencies,
  correctiveActions,
  rfis,
  submittals,
  changeEvents,
  payApplications,
  lienWaivers
}));
const optimizeControl = evaluateOptimizeControl({
  scorecards: projectPerformanceScorecards,
  lessons: lessonsLearned,
  productionRates: productionRateRecords,
  gcProfiles: gcPerformanceProfiles,
  vendorProfiles: vendorPerformanceProfiles,
  improvementActions,
  riskLibrary: riskLibraryItems
});
const missingDailyReports = dailyReports.filter((report) =>
  ["missing", "late"].includes(report.reportStatus)
);
const fieldExecutionSignals = dailyReports.filter(
  (report) =>
    report.blockers.length > 0 ||
    report.delays.length > 0 ||
    report.rfiNeeded ||
    report.changeEventNeeded ||
    report.productionStatus === "blocked" ||
    report.productionStatus === "behind"
);
const d4ControlExceptions = projects.filter((project) => {
  const projectReports = dailyReports.filter((report) => report.projectId === project.id);
  const projectWorkPackages = workPackages.filter((workPackage) => workPackage.projectId === project.id);
  const mobilizationPlan = mobilizationPlans.find((plan) => plan.projectId === project.id);

  return projectReports.length > 0 && !evaluateD4Gate({
    reports: projectReports,
    workPackages: projectWorkPackages,
    mobilizationPlan,
    project
  }).readyForCloseoutReviewBoolean;
});
const overdueRfIs = rfis.filter((rfi) => rfi.status === "overdue" || rfi.dueDate < operatingDate);
const overdueSubmittals = submittals.filter(
  (submittal) =>
    submittal.status === "revise_and_resubmit" ||
    submittal.status === "rejected" ||
    submittal.status === "overdue" ||
    submittal.dueDate < operatingDate
);
const agedCloseout = closeoutItems
  .filter((item) => item.status === "open" || item.status === "overdue")
  .sort((a, b) => b.agingDays - a.agingDays);
const overdueSafetyRecords = safetyRecords.filter((record) => record.status === "overdue");
const overdueQualityRecords = qualityRecords.filter((record) => record.status === "overdue");
const overdueOperationalItems =
  overdueRfIs.length +
  overdueSubmittals.length +
  missingDailyReports.length +
  overdueSafetyRecords.length +
  overdueQualityRecords.length +
  changeControl.noticeDeadlineRisks.length +
  changeControl.missingBackupItems.length +
  billingControl.missingBackupItems.length +
  billingControl.lienWaiverIssues.length +
  billingControl.agingPayApplications.length +
  safetyControl.overdueActions.length +
  safetyControl.incidentFollowUps.length +
  qualityControl.failedInspectionItems.length +
  qualityControl.missingEvidence.length +
  qualityControl.punchCloseoutRisks.length +
  d5Readiness.reduce((total, item) => total + item.acceptanceBlockers.length + item.finalBillingBlockers.length + item.retainageReleaseBlockers.length, 0) +
  optimizeControl.overdueImprovementActions.length +
  optimizeControl.rateUpdateRecommendations.length;
const missingArtifacts = projects.flatMap((project) =>
  project.gate.artifacts
    .filter((artifact) => artifact.status === "missing")
    .map((artifact) => ({ project, artifact }))
);
const workflowSummary = deriveOperatingWorkflows();
const notificationSummary = deriveOperatingNotifications(demoUser.role);
const leadershipOperatingActions = operatingActions.slice(0, 6);
const topLeadershipWorkflow = workflowSummary.topLeadershipWorkflows[0];

const projectCount = (project: RybexProject) => ({
  openRiskCount: risks.filter(
    (risk) => risk.projectId === project.id && risk.status !== "closed"
  ).length,
  openIssueCount: issues.filter(
    (issue) => issue.projectId === project.id && issue.status !== "resolved"
  ).length,
  openRfiCount: rfis.filter(
    (rfi) => rfi.projectId === project.id && !["closed", "answered"].includes(rfi.status)
  ).length,
  openChangeCount: changeEvents.filter(
    (event) => event.projectId === project.id && event.status !== "approved"
  ).length,
  missingArtifactCount: project.gate.artifacts.filter(
    (artifact) => artifact.status === "missing"
  ).length
});

export default function CommandCenterPage() {
  const pipelineValue = activeOpportunities.reduce(
    (total, opportunity) => total + opportunity.estimatedValue,
    0
  );
  const openChangeValue = openChanges.reduce(
    (total, change) => total + change.valueEstimate,
    0
  );

  return (
    <div className="command-grid">
      <PageHeader
        context={`Reporting context: ${dateLabel(operatingDate)}`}
        eyebrow="Rybex Infrastructure Group"
        primaryAction={{ href: "#leadership-attention", label: "Review At-Risk Work", tone: "primary" }}
        secondaryActions={[{ href: "/pipeline", label: "View Pipeline" }]}
        subtitle="Daily D5O operating control for pursuits, mobilization, field execution, commercial protection, closeout, and lessons learned."
        tags={[demoUser.title, "Demo data mode"]}
        title="Command Center"
      />

      <ActionWorkspaceLayout summary={getEndUserWorkspaceSummary("command-center")} />

      <section className="pipeline-guardrail" data-qa="pilot-mode-entry">
        <strong>Pilot Mode:</strong>
        <span>
          Complete the three proven operating workflows in one guided path. <Link href="/pilot">Open Pilot Mode</Link>.
        </span>
      </section>

      <CollapsedDetails
        count={overdueOperationalItems + workflowSummary.allOperatingWorkflows.length}
        title="Operating review details"
        summary="Leadership alerts, phase health, module metrics, watch lists, and exception registers."
      >
      <section className="role-context-band" aria-label="Command Center role context">
        <div>
          <span>Built for</span>
          <strong>CEO + operations leaders</strong>
        </div>
        <div>
          <span>See first</span>
          <strong>Decisions needed, cash at risk, blocked work, and gate health.</strong>
        </div>
        <div>
          <span>Next move</span>
          <strong>Assign the owner, clear the blocker, or drill into the module.</strong>
        </div>
      </section>

      <NotificationSummaryStrip summary={notificationSummary} />

      <EscalationQueue
        notifications={notificationSummary.escalationQueue}
        title="Critical escalations"
      />

      <NotificationPanel
        limit={3}
        notifications={notificationSummary.currentUserNotifications}
        title={`${demoUser.title} alerts`}
      />

      {topLeadershipWorkflow ? (
        <StageGateSummary
          dueDate={topLeadershipWorkflow.dueDate}
          evidenceNeeded={topLeadershipWorkflow.evidenceNeeded.required}
          gateName="Leadership Operating Gate"
          nextMovement={topLeadershipWorkflow.nextGateOrStatus.label}
          owner={topLeadershipWorkflow.owner}
          phase={topLeadershipWorkflow.d5oPhase}
          primaryBlocker={topLeadershipWorkflow.resolutionState === "blocked" || topLeadershipWorkflow.resolutionState === "overdue" ? topLeadershipWorkflow.signal.title : undefined}
          primaryCta={{ href: topLeadershipWorkflow.targetHref, label: "Open action" }}
          readinessPercent={topLeadershipWorkflow.severity === "critical" ? 38 : topLeadershipWorkflow.severity === "high" ? 56 : 74}
          requiredAction={topLeadershipWorkflow.requiredAction.title}
          requiredDecision={topLeadershipWorkflow.requiredDecision.question}
          status={topLeadershipWorkflow.resolutionState.replaceAll("_", " ")}
        />
      ) : null}

      {topLeadershipWorkflow ? (
        <NextBestAction
          after={topLeadershipWorkflow.nextGateOrStatus.label}
          ctaLabel="Go resolve"
          href={topLeadershipWorkflow.targetHref}
          title={topLeadershipWorkflow.requiredAction.title}
          why={topLeadershipWorkflow.consequenceIfMissed}
        />
      ) : null}

      <DecisionQueue
        limit={5}
        title="Leadership priorities"
        workflows={workflowSummary.topLeadershipWorkflows}
      />

      {topLeadershipWorkflow ? (
        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Complete Action</p>
              <h2>Act on the top workflow</h2>
            </div>
            <span className="muted">Open, confirm, and move the workflow forward.</span>
          </div>
          <WorkflowActionCard compact workflow={topLeadershipWorkflow} />
        </section>
      ) : null}

      <ProgressiveDetails
        count={workflowSummary.allOperatingWorkflows.length}
        severity="info"
        summary="Phase health and workflow volume by D5O stage."
        title="Stage/gate health map"
      >
        <WorkflowPhaseMap summary={workflowSummary} />
      </ProgressiveDetails>

      <section className="metrics-grid" aria-label="Operating summary">
        <div className="metric-card metric-info">
          <span className="metric-label">Active Projects</span>
          <strong>{projects.length}</strong>
          <span>Projects across D5O</span>
        </div>
        <div className="metric-card metric-info">
          <span className="metric-label">Pipeline</span>
          <strong>{activeOpportunities.length}</strong>
          <span>
            {compactCurrency.format(pipelineValue)} | {awaitingGoNoGo.length} awaiting gate
          </span>
        </div>
        <div className="metric-card metric-warning">
          <span className="metric-label">Leadership Attention</span>
          <strong>{atRiskProjects.length}</strong>
          <span>Watch, at-risk, critical, or blocked projects</span>
        </div>
        <div className="metric-card metric-critical">
          <span className="metric-label">Change Exposure</span>
          <strong>{compactCurrency.format(openChangeValue + billingControl.cashAtRisk)}</strong>
          <span>Open change exposure and billing cash at risk</span>
        </div>
        <div className="metric-card metric-critical">
          <span className="metric-label">Overdue Controls</span>
          <strong>{overdueOperationalItems + blockedMobilizations.length + fieldExecutionSignals.length}</strong>
          <span>RFIs, reports, safety, quality, D3 blockers, or D4 field signals</span>
        </div>
        <div className="metric-card metric-warning">
          <span className="metric-label">Closeout Aging</span>
          <strong>{agedCloseout.length}</strong>
          <span>Open or overdue closeout obligations</span>
        </div>
      </section>

      <section className="pipeline-guardrail">
        <strong>Enterprise readiness:</strong>
        <span>
          Demo data mode is active, {moduleImplementationStatuses.length} modules are represented, and the current role context is {demoUser.title}. <Link href="/admin">Review system readiness</Link>.
        </span>
      </section>

      <section className="command-focus" aria-label="Current command focus">
        <div>
          <p className="eyebrow">Command Focus</p>
          <h2>What needs operating attention now</h2>
        </div>
        <ul>
          <li>
            <strong>{blockedMobilizations.length}</strong>
            <span>D3 mobilizations blocked before D4 field execution</span>
          </li>
          <li>
            <strong>{bidsDueSoon.length}</strong>
            <span>Bids due in the next 7 days requiring pursuit discipline</span>
          </li>
          <li>
            <strong>{highRiskOpportunities.length}</strong>
            <span>High-risk opportunities needing mitigation or no-bid decision</span>
          </li>
          <li>
            <strong>{upcomingFieldStarts.length}</strong>
            <span>Upcoming field starts in the next 14 days</span>
          </li>
          <li>
            <strong>{fieldExecutionSignals.length}</strong>
            <span>D4 reports with blockers, delays, change prompts, or production drift</span>
          </li>
        </ul>
      </section>

      <ProgressiveDetails
        count={projects.length}
        severity="info"
        summary="Expanded D5O phase lanes for operating review."
        title="Active projects by phase"
      >
      <section className="panel panel-flat">
        <div className="section-heading">
          <div>
            <p className="eyebrow">D5O Flow</p>
            <h2>Active projects by operating phase</h2>
          </div>
          <span className="muted">Operating date: {dateLabel(operatingDate)}</span>
        </div>
        <div className="phase-lane-grid">
          {phaseIds.map((phaseId) => (
            <D5OPhaseSummary
              key={phaseId}
              phaseId={phaseId as D5OPhaseId}
              projects={projects.filter((project) => project.d5oPhase === phaseId)}
            />
          ))}
        </div>
      </section>
      </ProgressiveDetails>

      <ProgressiveDetails
        count={atRiskProjects.length}
        defaultOpen
        severity={atRiskProjects.length > 0 ? "warning" : "success"}
        summary="Projects and gates requiring leadership attention."
        title="Leadership watch list"
      >
      <div className="content-grid" id="leadership-attention">
        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Project Health</p>
              <h2>Leadership watch list</h2>
            </div>
            <span className="muted">Health, exposure, and missing controls</span>
          </div>

          <div className="project-stack">
            {atRiskProjects.map((project) => (
              <ProjectHealthCard
                key={project.id}
                project={project}
                {...projectCount(project)}
              />
            ))}
          </div>
        </section>

        <aside className="gate-stack" aria-label="Gate readiness exceptions">
          {atRiskProjects.slice(0, 3).map((project) => (
            <D5OPhaseGate compact gate={project.gate} key={project.gate.id} />
          ))}
        </aside>
      </div>
      </ProgressiveDetails>

      <ProgressiveDetails
        count={leadershipOperatingActions.length}
        defaultOpen
        severity="warning"
        summary="Highest business-impact actions only."
        title="Operating actions"
      >
      <div className="content-grid">
        <section className="panel" id="operating-actions">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Operating Actions</p>
              <h2>Required actions by business impact</h2>
            </div>
            <span className="muted">Top {leadershipOperatingActions.length} of {operatingActions.length} open actions</span>
          </div>
          <div className="action-stack">
            {leadershipOperatingActions.map((action) => (
              <OperatingActionItem
                action={action}
                key={action.id}
                project={getProjectById(action.projectId)}
              />
            ))}
          </div>
          {operatingActions.length > leadershipOperatingActions.length ? (
            <p className="muted panel-note">
              Remaining operating actions stay visible in their source modules so Command Center stays focused on leadership-level movement.
            </p>
          ) : null}
        </section>

        <aside className="panel">
          <p className="eyebrow">Gate Exceptions</p>
          <h2>Missing artifacts</h2>
          {missingArtifacts.length > 0 ? (
            <ul className="compact-list">
              {missingArtifacts.map(({ project, artifact }) => (
                <li key={`${project.id}-${artifact.id}`}>
                  <span className="artifact-state artifact-missing" />
                  <span>
                    <strong>{artifact.name}</strong>
                    <small className="muted">
                      {project.name} · owner {artifact.owner}
                      {artifact.dueDate ? ` · due ${dateLabel(artifact.dueDate)}` : ""}
                    </small>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">All current phase gates have required artifacts in place.</p>
          )}
        </aside>
      </div>
      </ProgressiveDetails>

      <ProgressiveDetails
        count={overdueOperationalItems + blockedMobilizations.length + fieldExecutionSignals.length}
        severity="critical"
        summary="Supporting registers and exception lists. Open only when drilling into the operating review."
        title="Detailed controls"
      >
      <section className="panel panel-flat">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Commercial and Delivery Controls</p>
            <h2>Items that affect payment, schedule, or entitlement</h2>
          </div>
        </div>
        <div className="operating-columns">
          <ControlList
            title="Bid pipeline"
            items={opportunities.map((opportunity) => ({
              id: opportunity.id,
              title: opportunity.name,
              meta: `${opportunity.gcClient} | ${opportunityStatusMap[opportunity.status].label} | ${currency.format(opportunity.estimatedValue)} | bid due ${dateLabel(opportunity.bidDueDate)}`,
              detail: opportunity.nextAction
            }))}
          />
          <ControlList
            title="Overdue RFIs / submittals"
            items={[
              ...overdueRfIs.map((rfi) => ({
                id: rfi.id,
                title: rfi.title,
                meta: `${rfi.projectName} · ${rfi.rfiNumber} · due ${dateLabel(rfi.dueDate)}`,
                detail: rfi.businessImpact
              })),
              ...overdueSubmittals.map((submittal) => ({
                id: submittal.id,
                title: submittal.title,
                meta: `${submittal.projectName} · ${submittal.submittalNumber} · due ${dateLabel(submittal.dueDate)}`,
                detail: submittal.businessImpact
              }))
            ]}
          />
          <ControlList
            title="Schedule-critical RFIs"
            items={rfiSubmittalControl.scheduleCriticalItems.map((rfi) => ({
              id: rfi.id,
              title: `${rfi.rfiNumber}: ${rfi.title}`,
              meta: `${rfi.projectName} · due ${dateLabel(rfi.dueDate)}`,
              detail: rfi.nextAction
            }))}
          />
          <ControlList
            title="Submittals blocking work"
            items={submittals
              .filter((submittal) => submittal.linkedWorkPackageIds.length > 0 && !["approved", "approved_as_noted", "closed"].includes(submittal.status))
              .map((submittal) => ({
                id: submittal.id,
                title: `${submittal.submittalNumber}: ${submittal.title}`,
                meta: `${submittal.projectName} · required ${dateLabel(submittal.requiredDate)}`,
                detail: submittal.businessImpact
              }))}
          />
          <ControlList
            title="Open change events"
            items={openChanges.map((change) => ({
              id: change.id,
              title: change.title,
              meta: `${change.projectName} · ${currency.format(change.valueEstimate)} · notice ${dateLabel(change.noticeDueDate)}`,
              detail: change.businessImpact
            }))}
          />
          <ControlList
            title="Change notice / backup risk"
            items={[...changeControl.noticeDeadlineRisks, ...changeControl.missingBackupItems].map((change) => ({
              id: change.id,
              title: `${change.changeNumber}: ${change.title}`,
              meta: `${change.projectName} · notice ${dateLabel(change.noticeDeadline)} · backup ${change.backupStatus}`,
              detail: change.requiredAction
            }))}
          />
          <ControlList
            title="Approved changes not billed"
            items={[
              ...changeEvents
                .filter((change) => change.billingStatus === "approved_not_billed")
                .map((change) => ({
                  id: change.id,
                  title: `${change.changeNumber}: ${change.title}`,
                  meta: `${change.projectName} · ${currency.format(change.approvedAmount)} approved`,
                  detail: change.requiredAction
                })),
              ...payApplications
                .filter((payApp) => payApp.excludedApprovedChangeEventIds.length > 0)
                .map((payApp) => ({
                  id: payApp.id,
                  title: `${payApp.payApplicationNumber}: approved change excluded`,
                  meta: `${payApp.projectName} · ${payApp.excludedApprovedChangeEventIds.length} excluded change(s)`,
                  detail: payApp.nextAction
                }))
            ]}
          />
          <ControlList
            title="Billing cash at risk"
            items={[
              ...billingControl.agingPayApplications.map((payApp) => ({
                id: payApp.id,
                title: `${payApp.payApplicationNumber}: ${payApp.projectName}`,
                meta: `Payment due ${dateLabel(payApp.paymentDueDate)} · requested ${currency.format(payApp.amountRequestedThisPeriod)}`,
                detail: payApp.nextAction
              })),
              ...commercialExposureItems
                .filter((item) => !["recovered", "written_off"].includes(item.status))
                .map((item) => ({
                  id: item.id,
                  title: item.title,
                  meta: `${currency.format(item.estimatedValue)} · due ${dateLabel(item.dueDate)}`,
                  detail: item.requiredAction
                }))
            ]}
          />
          <ControlList
            title="Billing backup / waivers"
            items={[
              ...billingControl.missingBackupItems.map((item) => ({
                id: item.id,
                title: item.title,
                meta: `${item.owner} · due ${dateLabel(item.dueDate)}`,
                detail: item.notes
              })),
              ...billingControl.lienWaiverIssues.map((waiver) => ({
                id: waiver.id,
                title: `${waiver.waiverType} waiver`,
                meta: `${currency.format(waiver.amount)} · required ${dateLabel(waiver.requiredDate)}`,
                detail: waiver.notes
              }))
            ]}
          />
          <ControlList
            title="Rejected / disputed exposure"
            items={changeEvents
              .filter((change) => change.rejectedAmount + change.disputedAmount > 0)
              .map((change) => ({
                id: change.id,
                title: `${change.changeNumber}: ${change.title}`,
                meta: `${change.projectName} · ${currency.format(change.rejectedAmount + change.disputedAmount)} at risk`,
                detail: change.requiredAction
              }))}
          />
          <ControlList
            title="Missing daily reports"
            items={missingDailyReports.map((report) => ({
              id: report.id,
              title: `${getProjectById(report.projectId)?.name ?? "Unknown project"} daily report`,
              meta: `${report.supervisor} · ${dateLabel(report.reportDate)} · ${report.workPackageName}`,
              detail: report.blockers.map((blocker) => blocker.title).join(", ") || report.workPerformed
            }))}
          />
          <ControlList
            title="D4 field execution signals"
            items={fieldExecutionSignals.map((report) => ({
              id: report.id,
              title: report.workPackageName,
              meta: `${report.projectName} · ${report.productionStatus} · ${dateLabel(report.reportDate)}`,
              detail:
                report.changedConditions[0]?.description ||
                report.blockers[0]?.businessImpact ||
                report.delays[0]?.reason ||
                report.nextDayPlan
            }))}
          />
          <ControlList
            title="Safety blockers / overdue actions"
            items={[
              ...safetyControl.overdueActions.map((action) => ({
                id: action.id,
                title: action.title,
                meta: `${action.projectName} · ${action.owner} · due ${dateLabel(action.dueDate)}`,
                detail: action.nextAction
              })),
              ...jhaRecords
                .filter((record) => record.requiredBeforeWork && (!record.crewAcknowledged || ["blocked", "draft", "overdue"].includes(record.status)))
                .map((record) => ({
                  id: record.id,
                  title: record.title,
                  meta: `${record.projectName} · ${record.owner} · ${dateLabel(record.date)}`,
                  detail: record.nextAction
                }))
            ]}
          />
          <ControlList
            title="Incident / near-miss follow-up"
            items={safetyControl.incidentFollowUps.map((incident) => ({
              id: incident.id,
              title: incident.description,
              meta: `${incident.projectName} · ${incident.severity} · ${dateLabel(incident.date)}`,
              detail: incident.nextAction
            }))}
          />
          <ControlList
            title="Quality deficiencies / failed inspections"
            items={[
              ...qualityControl.failedInspectionItems.map((inspection) => ({
                id: inspection.id,
                title: inspection.title,
                meta: `${inspection.projectName} · ${inspection.inspector} · ${dateLabel(inspection.date)}`,
                detail: inspection.nextAction
              })),
              ...qualityDeficiencies
                .filter((deficiency) => !["closed", "verified"].includes(deficiency.status))
                .slice(0, 6)
                .map((deficiency) => ({
                  id: deficiency.id,
                  title: deficiency.title,
                  meta: `${deficiency.projectName} · ${deficiency.assignedTo} · ${deficiency.status}`,
                  detail: deficiency.nextAction
                }))
            ]}
          />
          <ControlList
            title="Quality evidence gaps / punch risks"
            items={[
              ...qualityControl.missingEvidence.slice(0, 6).map((item) => ({
                id: item,
                title: item,
                meta: "Required for D5 closeout evidence",
                detail: "Capture or verify evidence while work remains visible."
              })),
              ...qualityControl.punchCloseoutRisks.slice(0, 6).map((item) => ({
                id: item.id,
                title: item.title,
                meta: `${item.projectName} · due ${dateLabel(item.dueDate)}`,
                detail: item.nextAction
              }))
            ]}
          />
          <ControlList
            title="D5 closeout packages blocked"
            items={d5Readiness
              .filter((readiness) => readiness.closeoutReadinessScore < 80 || readiness.requiredActions.length > 0)
              .map((readiness) => {
                const closeoutPackage = closeoutPackages.find((item) =>
                  item.nextAction === readiness.nextActions[0] ||
                  item.readinessScore === readiness.closeoutReadinessScore
                );
                const matchedPackage = closeoutPackage ?? closeoutPackages.find((item) =>
                  readiness.nextActions.includes(item.nextAction)
                );

                return {
                  id: matchedPackage?.id ?? readiness.recommendedDecision,
                  title: matchedPackage?.projectName ?? "Closeout package",
                  meta: `${readiness.closeoutReadinessScore}% D5 readiness`,
                  detail: readiness.requiredActions[0] ?? readiness.nextActions[0] ?? "Complete D5 package requirements."
                };
              })}
          />
          <ControlList
            title="Missing as-builts / test records"
            items={[
              ...closeoutRequirements
                .filter((item) => ["as_built", "redline", "test_record"].includes(item.category) && !["accepted", "waived", "archived"].includes(item.status))
                .map((item) => ({
                  id: item.id,
                  title: item.title,
                  meta: `${getProjectById(item.projectId)?.name ?? "Unknown project"} · due ${dateLabel(item.dueDate)}`,
                  detail: item.nextAction
                })),
              ...asBuiltRecords
                .filter((item) => !["accepted", "waived", "archived"].includes(item.status))
                .map((item) => ({
                  id: item.id,
                  title: item.title,
                  meta: `${getProjectById(item.projectId)?.name ?? "Unknown project"} · ${item.drawingReference}`,
                  detail: item.nextAction
                }))
            ]}
          />
          <ControlList
            title="Final billing / retainage blockers"
            items={d5Readiness.flatMap((readiness, index) => {
              const closeoutPackage = closeoutPackages[index];
              return [...readiness.finalBillingBlockers, ...readiness.retainageReleaseBlockers].map((blocker) => ({
                id: `${closeoutPackage.id}-${blocker}`,
                title: closeoutPackage.projectName,
                meta: `${closeoutPackage.packageNumber} · D5 commercial closure`,
                detail: blocker
              }));
            })}
          />
          <ControlList
            title="Acceptance / archive readiness"
            items={[
              ...acceptanceRecords
                .filter((item) => ["submitted", "under_review", "accepted_with_exceptions", "rejected"].includes(item.status))
                .map((item) => ({
                  id: item.id,
                  title: getProjectById(item.projectId)?.name ?? "Acceptance package",
                  meta: `${item.reviewerOrganization} · ${item.status.replaceAll("_", " ")}`,
                  detail: item.nextAction
                })),
              ...warrantyRecords
                .filter((item) => ["missing", "not_started", "rejected", "blocked"].includes(item.status))
                .map((item) => ({
                  id: item.id,
                  title: item.title,
                  meta: `${getProjectById(item.projectId)?.name ?? "Unknown project"} · archive requirement`,
                  detail: item.nextAction
                }))
            ]}
          />
          <ControlList
            title="Optimize actions overdue"
            items={optimizeControl.overdueImprovementActions.map((action) => ({
              id: action.id,
              title: action.title,
              meta: `${action.owner} · due ${dateLabel(action.dueDate)}`,
              detail: action.description
            }))}
          />
          <ControlList
            title="Production rates needing review"
            items={optimizeControl.rateUpdateRecommendations.map((rate) => ({
              id: rate.id,
              title: rate.workType,
              meta: `${rate.variancePercent}% variance · ${rate.confidenceLevel} confidence`,
              detail: `Recommended estimating rate: ${rate.recommendedEstimatingRate} ${rate.unitOfMeasure}.`
            }))}
          />
          <ControlList
            title="GC / vendor performance warnings"
            items={[
              ...optimizeControl.gcPerformanceRisks.map((profile) => ({
                id: profile.id,
                title: profile.gcClient,
                meta: `GC score ${profile.overallScore} · posture ${profile.recommendedPursuitPosture.replaceAll("_", " ")}`,
                detail: profile.notes
              })),
              ...optimizeControl.vendorPerformanceRisks.map((profile) => ({
                id: profile.id,
                title: profile.vendorName,
                meta: `Vendor score ${profile.overallScore} · posture ${profile.recommendedUsePosture.replaceAll("_", " ")}`,
                detail: profile.notes
              }))
            ]}
          />
          <ControlList
            title="Risk library update recommendations"
            items={optimizeControl.riskLibraryUpdateRecommendations.slice(0, 8).map((risk) => ({
              id: risk.id,
              title: risk.title,
              meta: `Update ${risk.affectedModules.join(", ")}`,
              detail: risk.recommendedMitigation
            }))}
          />
          <ControlList
            title="D5 closeout readiness risk"
            items={d4ControlExceptions.map((project) => {
              const projectReports = dailyReports.filter((report) => report.projectId === project.id);
              const projectWorkPackages = workPackages.filter((workPackage) => workPackage.projectId === project.id);
              const mobilizationPlan = mobilizationPlans.find((plan) => plan.projectId === project.id);
              const readiness = evaluateD4Gate({
                reports: projectReports,
                workPackages: projectWorkPackages,
                mobilizationPlan,
                project
              });

              return {
                id: project.id,
                title: project.name,
                meta: `${readiness.controlScore}% D4 control score`,
                detail: readiness.requiredActions[0] ?? "Complete D4 documentation before D5 closeout review."
              };
            })}
          />
          <ControlList
            title="Closeout aging"
            items={agedCloseout.map((item) => ({
              id: item.id,
              title: item.title,
              meta: `${getProjectById(item.projectId)?.name ?? "Unknown project"} · ${item.agingDays} days aging`,
              detail: item.businessImpact
            }))}
          />
          <ControlList
            title="Upcoming decisions"
            items={decisions.map((decision) => ({
              id: decision.id,
              title: decision.title,
              meta: `${getProjectById(decision.projectId)?.name ?? "Unknown project"} · ${decision.owner} · due ${dateLabel(decision.dueDate)}`,
              detail: decision.requiredAction
            }))}
          />
          <ControlList
            title="D3 mobilization blockers"
            items={blockedMobilizations.map((plan) => ({
              id: plan.id,
              title: plan.projectName,
              meta: `${plan.mobilizationOwner} | field start ${dateLabel(plan.plannedFieldStartDate)}`,
              detail: plan.nextAction
            }))}
          />
        </div>
      </section>
      </ProgressiveDetails>
      </CollapsedDetails>
    </div>
  );
}

function daysUntil(date: string) {
  const now = new Date(`${operatingDate}T12:00:00`);
  const target = new Date(`${date}T12:00:00`);

  return Math.max(0, Math.ceil((target.getTime() - now.getTime()) / 86400000));
}

type ControlListProps = {
  title: string;
  items: {
    id: string;
    title: string;
    meta: string;
    detail: string;
  }[];
};

function ControlList({ title, items }: ControlListProps) {
  return (
    <section className="control-list">
      <h3>{title}</h3>
      {items.length > 0 ? (
        <ul className="compact-list">
          {items.map((item, index) => (
            <li key={`control-${title}-${item.id}-${item.title}-${index}`}>
              <span className="artifact-state artifact-pending" />
              <span>
                <strong>{item.title}</strong>
                <small className="muted">{item.meta}</small>
                <p>{item.detail}</p>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No exceptions in this control area.</p>
      )}
    </section>
  );
}
