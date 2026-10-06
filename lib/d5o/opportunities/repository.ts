import type { CreateOpportunityInput, OpportunityDetail, OpportunityAction, QualificationInput } from "./types";

export type OpportunityRepository = {
  listOpportunityActions(): Promise<OpportunityAction[]>;
  getOpportunityById(id: string): Promise<OpportunityDetail | null>;
  createOpportunity(input: CreateOpportunityInput, commandId: string): Promise<OpportunityDetail | { error: string; message?: string; duplicateCount?: number }>;
  saveQualification(id: string, input: QualificationInput, expectedVersion: number, commandId: string): Promise<OpportunityDetail | { error: string; message?: string; currentVersion?: number }>;
  submitForDecision(id: string, expectedVersion: number, commandId: string): Promise<OpportunityDetail | { error: string; message?: string; currentVersion?: number }>;
};
