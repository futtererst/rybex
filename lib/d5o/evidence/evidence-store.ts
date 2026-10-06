export type RybexEvidenceStoreMode = "local" | "database";

const allowedModes: RybexEvidenceStoreMode[] = ["local", "database"];

export function getEvidenceStoreMode(): RybexEvidenceStoreMode {
  const configuredMode = process.env.RYBEXOS_EVIDENCE_STORE;

  if (configuredMode && allowedModes.includes(configuredMode as RybexEvidenceStoreMode)) {
    return configuredMode as RybexEvidenceStoreMode;
  }

  if (process.env.RYBEXOS_RUNTIME_MODE === "production") {
    return "database";
  }

  return "local";
}

export function isLocalEvidenceStore() {
  return getEvidenceStoreMode() === "local";
}

export function isDatabaseEvidenceStore() {
  return getEvidenceStoreMode() === "database";
}
