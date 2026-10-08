export function normalizeOpportunityFingerprint(customerGc: string, name: string, location: string) {
  return `${customerGc}|${name}|${location}`.replace(/[^a-zA-Z0-9|]+/g, "").toLowerCase();
}
