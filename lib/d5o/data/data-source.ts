export type RybexDataSourceMode = "seed" | "database";

const allowedModes: RybexDataSourceMode[] = ["seed", "database"];

export function getDataSourceMode(): RybexDataSourceMode {
  const configuredMode = process.env.RYBEXOS_DATA_SOURCE;

  if (configuredMode && allowedModes.includes(configuredMode as RybexDataSourceMode)) {
    return configuredMode as RybexDataSourceMode;
  }

  if (process.env.RYBEXOS_RUNTIME_MODE === "production") {
    return "database";
  }

  return "seed";
}

export function isSeedMode() {
  return getDataSourceMode() === "seed";
}

export function isDatabaseMode() {
  return getDataSourceMode() === "database";
}
