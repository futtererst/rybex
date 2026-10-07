import { activeForecast, weightedPotential } from "./discover-decision";
import type { WorkRecord } from "./work-types";

export type ForecastPeriod = "month" | "quarter";
export type ForecastGroup = {
  period: string;
  currency: string;
  category: string;
  workIds: string[];
  unweighted: number;
  weighted: number;
  missingValue: number;
  missingProbability: number;
  pastDue: number;
  movement: number | null;
};

export function forecastPeriod(date: string, granularity: ForecastPeriod): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "Date unknown";
  if (granularity === "month") return date.slice(0, 7);
  return `${date.slice(0, 4)} Q${Math.ceil(Number(date.slice(5, 7)) / 3)}`;
}

/** Each Work Record contributes once, using its current reviewed Discover forecast. */
export function groupIndicativeOrders(records: WorkRecord[], granularity: ForecastPeriod, asOf: string): ForecastGroup[] {
  const groups = new Map<string, ForecastGroup>();
  for (const work of records) {
    if (!activeForecast(work)) continue;
    const crm = work.discovery?.crm;
    if (!crm) continue;
    const { forecast } = crm;
    const period = forecastPeriod(forecast.awardDate, granularity);
    const currency = forecast.currency || "Unknown";
    const category = forecast.category;
    const key = `${period}\u0000${currency}\u0000${category}`;
    const group = groups.get(key) ?? {
      period, currency, category, workIds: [], unweighted: 0, weighted: 0,
      missingValue: 0, missingProbability: 0, pastDue: 0, movement: 0,
    };
    group.workIds.push(work.id);
    if (forecast.value === null) group.missingValue++;
    else group.unweighted += forecast.value;
    const weighted = weightedPotential(crm);
    if (weighted === null) group.missingProbability++;
    else group.weighted += weighted;
    if (forecast.awardDate && forecast.awardDate < asOf) group.pastDue++;
    const snapshots = crm.forecastSnapshots ?? [];
    if (snapshots.length >= 2) {
      const previous = snapshots[snapshots.length - 2];
      if (group.movement !== null && previous.currency === currency && previous.weighted !== null && weighted !== null)
        group.movement += weighted - previous.weighted;
      else group.movement = null;
    } else group.movement = null;
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => a.period.localeCompare(b.period) || a.currency.localeCompare(b.currency) || a.category.localeCompare(b.category));
}
