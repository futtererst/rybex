import type { CloseoutFinalBillingBlocker } from "./types";

export function isCloseoutDatabaseBacked(blocker: CloseoutFinalBillingBlocker) {
  return Boolean((blocker as CloseoutFinalBillingBlocker & { databaseBacked?: boolean }).databaseBacked);
}
