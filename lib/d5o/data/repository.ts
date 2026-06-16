import { calculateGoNoGo } from "../go-no-go";
import { moduleImplementationStatuses } from "../implementation-status";
import { evaluateD2Gate } from "../d2-gate";
import { evaluateD3Gate } from "../d3-gate";
import { evaluateD4Gate } from "../d4-gate";
import { evaluateD5Gate } from "../d5-gate";
import { evaluateBillingControl } from "../billing-control";
import { evaluateChangeControl } from "../change-control";
import { evaluateOptimizeControl } from "../optimize-control";
import { evaluateQualityControl } from "../quality-control";
import { evaluateSafetyControl } from "../safety-control";
import * as seedData from "../seed-data";
import { demoAuditEvents } from "../audit";
import { databaseRepository } from "./database-repository";
import { getDataSourceMode } from "./data-source";
import type { RybexDataRepository } from "./contracts";
import { getBillingData } from "./get-billing-data";
import { getChangeControlData } from "./get-change-control-data";
import { getCloseoutData } from "./get-closeout-data";
import { getCommandCenterData } from "./get-command-center-data";
import { getFieldExecutionData } from "./get-field-execution-data";
import { getMobilizationData } from "./get-mobilization-data";
import { getOptimizeData } from "./get-optimize-data";
import { getPipelineData } from "./get-pipeline-data";
import { getProjectsData } from "./get-projects-data";
import { getQualityData } from "./get-quality-data";
import { getRfiSubmittalData } from "./get-rfi-submittal-data";
import { getSafetyData } from "./get-safety-data";

function seedReadOnly(method: string): never {
  throw new Error(`Seed repository is read-only for ${method}. Use guided demo state or enable a future database repository.`);
}

export const seedRepository: RybexDataRepository = {
  commandCenter: {
    getCommandCenterData
  },
  pipeline: {
    getPipelineData,
    getOpportunityById: (id) => seedData.opportunities.find((opportunity) => opportunity.id === id),
    createOpportunity: () => seedReadOnly("createOpportunity"),
    updateOpportunity: () => seedReadOnly("updateOpportunity"),
    evaluateGoNoGo: calculateGoNoGo
  },
  projects: {
    getProjectsData,
    getProjectById: (id) => seedData.projects.find((project) => project.id === id),
    createProjectSetup: () => seedReadOnly("createProjectSetup"),
    evaluateD2Gate: (projectId) => {
      const project = seedData.projects.find((candidate) => candidate.id === projectId);
      return project ? evaluateD2Gate(project) : undefined;
    }
  },
  mobilization: {
    getMobilizationData,
    getMobilizationPlanById: (id) => seedData.mobilizationPlans.find((plan) => plan.id === id),
    createMobilizationPlan: () => seedReadOnly("createMobilizationPlan"),
    evaluateD3Gate: (planId) => {
      const plan = seedData.mobilizationPlans.find((candidate) => candidate.id === planId);
      const project = seedData.projects.find((candidate) => candidate.id === plan?.projectId);
      return plan ? evaluateD3Gate(plan, project) : undefined;
    }
  },
  fieldExecution: {
    getFieldExecutionData,
    getDailyReportById: (id) => seedData.dailyReports.find((report) => report.id === id),
    createDailyReport: () => seedReadOnly("createDailyReport"),
    evaluateD4Control: (projectId) => {
      const project = seedData.projects.find((candidate) => candidate.id === projectId);
      const reports = seedData.dailyReports.filter((report) => report.projectId === projectId);
      const workPackages = seedData.workPackages.filter((workPackage) => workPackage.projectId === projectId);
      const mobilizationPlan = seedData.mobilizationPlans.find((plan) => plan.projectId === projectId);

      return project ? evaluateD4Gate({ project, reports, workPackages, mobilizationPlan }) : undefined;
    }
  },
  rfiSubmittal: {
    getRfiSubmittalData,
    createRfi: () => seedReadOnly("createRfi"),
    createSubmittal: () => seedReadOnly("createSubmittal"),
    linkRfiToChangeEvent: () => seedReadOnly("linkRfiToChangeEvent")
  },
  changeControl: {
    getChangeControlData,
    createChangeEvent: () => seedReadOnly("createChangeEvent"),
    updateChangeEventStatus: () => seedReadOnly("updateChangeEventStatus"),
    evaluateCommercialControl: () => evaluateChangeControl({ changeEvents: seedData.changeEvents, dailyReports: seedData.dailyReports })
  },
  billing: {
    getBillingData,
    createPayApplication: () => seedReadOnly("createPayApplication"),
    evaluateBillingReadiness: () => evaluateBillingControl({
      payApplications: seedData.payApplications,
      backupItems: seedData.billingBackupItems,
      lienWaivers: seedData.lienWaivers,
      commercialExposure: seedData.commercialExposureItems,
      changeEvents: seedData.changeEvents
    })
  },
  safety: {
    getSafetyData,
    createSafetyRecord: () => seedReadOnly("createSafetyRecord"),
    createJhaRecord: () => seedReadOnly("createJhaRecord"),
    evaluateSafetyControl: () => evaluateSafetyControl({
      safetyPlans: seedData.safetyPlans,
      jhaRecords: seedData.jhaRecords,
      toolboxTalks: seedData.toolboxTalks,
      observations: seedData.safetyObservations,
      incidents: seedData.safetyIncidents,
      correctiveActions: seedData.correctiveActions
    })
  },
  quality: {
    getQualityData,
    createInspection: () => seedReadOnly("createInspection"),
    createDeficiency: () => seedReadOnly("createDeficiency"),
    evaluateQualityControl: () => evaluateQualityControl({
      inspections: seedData.qualityInspections,
      deficiencies: seedData.qualityDeficiencies,
      tests: seedData.testRecords,
      punchItems: seedData.punchItems,
      correctiveActions: seedData.correctiveActions
    })
  },
  closeout: {
    getCloseoutData,
    createCloseoutPackage: () => seedReadOnly("createCloseoutPackage"),
    evaluateD5Gate: (projectId) => {
      const closeoutPackage = seedData.closeoutPackages.find((candidate) => candidate.projectId === projectId);

      return closeoutPackage
        ? evaluateD5Gate({
            closeoutPackage,
            project: seedData.projects.find((project) => project.id === projectId),
            requirements: seedData.closeoutRequirements,
            acceptanceRecords: seedData.acceptanceRecords,
            dailyReports: seedData.dailyReports,
            punchItems: seedData.punchItems,
            testRecords: seedData.testRecords,
            qualityDeficiencies: seedData.qualityDeficiencies,
            correctiveActions: seedData.correctiveActions,
            rfis: seedData.rfis,
            submittals: seedData.submittals,
            changeEvents: seedData.changeEvents,
            payApplications: seedData.payApplications,
            lienWaivers: seedData.lienWaivers
          })
        : undefined;
    }
  },
  optimize: {
    getOptimizeData,
    createLessonsLearnedReview: () => seedReadOnly("createLessonsLearnedReview"),
    updateProductionRate: () => seedReadOnly("updateProductionRate"),
    evaluateOptimizeControl: () => evaluateOptimizeControl({
      scorecards: seedData.projectPerformanceScorecards,
      lessons: seedData.lessonsLearned,
      productionRates: seedData.productionRateRecords,
      gcProfiles: seedData.gcPerformanceProfiles,
      vendorProfiles: seedData.vendorPerformanceProfiles,
      improvementActions: seedData.improvementActions,
      riskLibrary: seedData.riskLibraryItems
    })
  },
  admin: {
    getImplementationStatus: () => moduleImplementationStatuses,
    getSystemReadiness: () => ({
      implementationStatus: moduleImplementationStatuses,
      auditEvents: demoAuditEvents,
      dataSourceMode: getDataSourceMode()
    })
  },
  workflowTransactions: {
    getWorkflowInstances: () => [],
    getWorkflowInstanceById: () => undefined,
    getWorkflowTransactions: () => [],
    createWorkflowTransaction: () => seedReadOnly("createWorkflowTransaction"),
    updateWorkflowResolutionState: () => seedReadOnly("updateWorkflowResolutionState"),
    getWorkflowEvidenceRequirements: () => [],
    createWorkflowEvidenceRequirement: () => seedReadOnly("createWorkflowEvidenceRequirement"),
    linkWorkflowSource: () => seedReadOnly("linkWorkflowSource")
  },
  evidenceAttachments: {
    createAttachmentMetadata: () => seedReadOnly("createAttachmentMetadata"),
    linkAttachmentToEntity: () => seedReadOnly("linkAttachmentToEntity"),
    attachEvidenceToRequirement: () => seedReadOnly("attachEvidenceToRequirement"),
    getEvidenceAttachments: () => []
  }
};

export function getRybexDataRepository() {
  return getDataSourceMode() === "database" ? databaseRepository : seedRepository;
}
