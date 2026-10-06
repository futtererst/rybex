export type WorkspaceKey = "rybex" | "rotork";
export type DefinitionSource = { revision: number; configurationVersionId: string; workTypeKey: string; capturedAt: string };
export type ProposalStatus = "Not started" | "Draft" | "Internal review" | "Changes requested" | "Approved" | "Submitted";
export type ProposalPackage = { revision: number; estimateRevision: number; scope: string; assumptions: string; exclusions: string; commercialTerms: string; sellPrice: number; preparedAt: string; definitionSource?: DefinitionSource; changeReason?: string };
export type ProposalReview = { revision: number; submittedAt: string; submittedBy: string; submittedByActorId?: string; submittedByMembershipId?: string; dueDate: string; authorityProfileId?: string; authorityRole?: string; grossMarginPercent?: number; priceChangePercent?: number; scopeChanged?: boolean; termsChanged?: boolean; decidedAt?: string; decisionNote?: string; decidedBy?: string; actorId?: string; membershipId?: string };
export type ProposalResponse = { revision: number; status: "Clarification requested" | "Commercial negotiation" | "Decision deferred" | "Awarded" | "Not awarded"; receivedAt: string; details: string; nextAction?: string; followUpDue?: string; recordedByActorId?: string; recordedByMembershipId?: string };
export type ProposalSubmission = { revision: number; estimateRevision: number; recordedAt: string; recipient: string; method: string; responseDueDate: string; packageSnapshot?: ProposalPackage; recordedByActorId?: string; recordedByMembershipId?: string };
export type DesignHandoffBrief = { offerRevision: number; estimateRevision: number; definitionRevision: number; configurationVersionId: string; customerOutcome: string; acceptance: string; offerScope: string; excludedScope: string; deliveryApproach: string; dependencies: string; risks: string; commercialTerms: string; awardBasis: string };
export type DesignHandoff = { revision: number; status: "submitted" | "returned" | "accepted"; brief: DesignHandoffBrief; responseDueDate: string; submittedAt: string; submittedBy: string; submittedByActorId: string; submittedByMembershipId: string; decidedAt?: string; decidedBy?: string; decidedByActorId?: string; decidedByMembershipId?: string; decisionNote?: string };
export type DesignHandoffEvent = { revision: number; state: DesignHandoff["status"]; at: string; actorId: string; membershipId: string; note: string; brief?: DesignHandoffBrief };

export type DiscoveryRecord = {
  pursuitControl?: {
    revision: number;
    status: "draft" | "submitted" | "returned" | "qualified" | "held" | "declined";
    requester: string; intendedOutcome: string; roughValue: string; currency: string; requiredDate: string; knownRisk: string;
    submission?: { revision: number; at: string; actor: string };
    decision?: { revision: number; outcome: "qualified" | "held" | "declined" | "returned"; reason: string; at: string; actor: string };
    spend?: { status: "not_requested" | "requested" | "authorized" | "returned"; cap: number; purpose: string; reason?: string; actor?: string; at?: string };
    handoff?: { status: "not_started" | "submitted" | "returned" | "accepted"; receiver: string; brief: string; reason?: string; revision: number; actor?: string; at?: string };
    history: Array<{ revision: number; action: string; actor: string; at: string; note: string }>;
  };
  source: string;
  need: string;
  procurement: string;
  phase: "Qualification" | "Estimate" | "Pricing review" | "Proposal" | "Submitted" | "Validation" | "Clarification" | "Outcome";
  fit: "Unassessed" | "Qualified" | "Conditional" | "Disqualified";
  closeDate: string;
  estimate: { revision: number; labor: number; materials: number; subcontract: number; travel: number; contingency: number; targetMargin: number; sellPrice: number; status: "Not started" | "Draft" | "Pricing review" | "Approved" | "Changes requested"; assumption: string; definitionSource?: DefinitionSource; review?: { revision: number; submittedAt: string; submittedBy: string; submittedByActorId?: string; submittedByMembershipId?: string; dueDate?: string; decidedAt?: string; decisionNote?: string; decidedBy?: string; actorId?: string; membershipId?: string }; pricingHistory?: Array<{ revision: number; state: "Submitted" | "Approved" | "Changes requested"; at: string; note: string; cost: number; sellPrice: number; targetMargin: number }> };
  proposal: { status: ProposalStatus; dueDate: string; method: string; recipient: string; response: string; package?: ProposalPackage; packageHistory?: ProposalPackage[]; review?: ProposalReview; submission?: ProposalSubmission; submissionHistory?: ProposalSubmission[]; responseEvents?: ProposalResponse[]; history?: Array<{ revision: number; state: string; at: string; note: string }> };
  outcome?: "Won" | "Lost" | "No bid";
  outcomeNote?: string;
  designHandoff?: DesignHandoff;
  designHandoffHistory?: DesignHandoffEvent[];
};

export type DefinitionRecord = {
  revision: number;
  sourceEstimateRevision?: number;
  sourceProposalRevision?: number;
  configurationVersion?: string;
  configurationWorkTypeKey?: string;
  registers?: Record<string, Array<Record<string, string>>>;
  status: "Draft" | "In review" | "Changes requested" | "Approved";
  outcome: string;
  acceptance: string;
  includedScope: string;
  excludedScope: string;
  deliveryApproach: string;
  milestones: string;
  dependencies: string;
  estimateBasis: string;
  commercialTerms: string;
  risks: string;
  owner: string;
  reviews?: { commercial: "Pending" | "Approved" | "Changes requested"; delivery: "Pending" | "Approved" | "Changes requested"; revision: number };
  history: Array<{ at: string; revision: number; event: string; note: string }>;
};

export type WorkRecord = {
  id: string; workspace: WorkspaceKey; title: string; type: string; customer: string; site: string; stage: string; owner: string;
  phaseConfigurationVersionId?: string;
  nextAction: string; nextActionDue?: string | null; nextActionImpact?: "Critical" | "High" | "Standard" | null;
  progress: number; value: string; status: "attention" | "moving" | "complete"; proof: string[]; blockers: string[]; history: string[];
  commercial?: { condition: string; amount: string; confidence: string };
  discovery?: DiscoveryRecord;
  definition?: DefinitionRecord;
  phaseRegisters?: Record<string, Array<Record<string, string>>>;
};
