import { closeoutFinalBillingLocalRepository } from "./local-repository";
import { getCloseoutFinalBillingPersistenceMode } from "./persistence-mode";
import { closeoutFinalBillingSupabaseRepository } from "./supabase-repository";

export function getCloseoutFinalBillingRepository() {
  return getCloseoutFinalBillingPersistenceMode() === "database"
    ? closeoutFinalBillingSupabaseRepository
    : closeoutFinalBillingLocalRepository;
}
