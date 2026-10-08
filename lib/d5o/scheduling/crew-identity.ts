import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { WorkspaceKey } from "@/components/d5o/platform/schedule-model";

export const scheduleWorkspaceKeys: Record<string, WorkspaceKey> = {
  "5488a1a7-d6eb-460c-88a4-4629d742d705": "rybex",
  "fd59e25e-8fa3-496c-8e1f-58a3f0c0fdb6": "rotork"
};

type CrewIdentity = { workspace: WorkspaceKey; person: string; userId: string };
const registry = path.join(process.cwd(), ".rybexos-local", "d5o-shared-schedule-v1", "crew-identities.json");

/** The local synthetic fixture binds roster names to immutable Auth user IDs. */
export async function crewPersonForUser(workspace: WorkspaceKey, userId: string): Promise<string | null> {
  let raw: string;
  try { raw = await readFile(registry, "utf8"); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || !parsed.every((entry) => entry && typeof entry === "object"
    && (entry.workspace === "rybex" || entry.workspace === "rotork") && typeof entry.person === "string" && typeof entry.userId === "string"))
    throw new Error("Invalid synthetic crew identity registry.");
  const matches = (parsed as CrewIdentity[]).filter((entry) => entry.workspace === workspace && entry.userId === userId);
  if (matches.length > 1) throw new Error("Ambiguous synthetic crew identity.");
  return matches[0]?.person ?? null;
}

/** Only a unique, explicitly provisioned worker identity may receive a booking notice. */
export async function crewUserForPerson(workspace: WorkspaceKey, person: string): Promise<string | null> {
  let raw: string;
  try { raw = await readFile(registry, "utf8"); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
  const entries = JSON.parse(raw) as CrewIdentity[];
  if (!Array.isArray(entries) || !entries.every((entry) => entry && (entry.workspace === "rybex" || entry.workspace === "rotork")
    && typeof entry.person === "string" && typeof entry.userId === "string")) throw new Error("Invalid synthetic crew identity registry.");
  const matches = entries.filter((entry) => entry.workspace === workspace && entry.person === person);
  if (matches.length > 1) throw new Error("Ambiguous synthetic crew identity.");
  return matches[0]?.userId ?? null;
}
