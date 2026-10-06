import "server-only";
import { mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { WorkspaceKey } from "@/components/d5o/platform/schedule-model";
import { assertSnapshotCommercialIntegrity } from "./commercial-command";
import { PrototypeWorkError } from "./store-error";

export { PrototypeWorkError } from "./store-error";

export type PrototypeWorkState = { schemaVersion: 1; workspace: WorkspaceKey; revision: number; records: Record<string, unknown>[] };
const root = path.join(process.cwd(), ".rybexos-local", "d5o-shared-prototype-work-v1");
const fileFor = (workspace: WorkspaceKey) => path.join(root, `${workspace}.json`);
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const initial = (workspace: WorkspaceKey): PrototypeWorkState => ({ schemaVersion: 1, workspace, revision: 1, records: [] });
async function readUnlocked(workspace: WorkspaceKey): Promise<PrototypeWorkState | null> {
  let raw: string;
  try { raw = await readFile(fileFor(workspace), "utf8"); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
  let state: PrototypeWorkState;
  try { state = JSON.parse(raw) as PrototypeWorkState; }
  catch { throw new PrototypeWorkError("invalid_state", 500, "Shared prototype Work Record state cannot be parsed."); }
  if (state.schemaVersion !== 1 || state.workspace !== workspace || !Number.isInteger(state.revision)
      || !Array.isArray(state.records) || state.records.length > 100
      || state.records.some((record) => !record || typeof record !== "object" || record.workspace !== workspace || typeof record.id !== "string"))
    throw new PrototypeWorkError("invalid_state", 500, "Shared prototype Work Record state needs review.");
  return state;
}
async function writeUnlocked(workspace: WorkspaceKey, state: PrototypeWorkState) {
  const target = fileFor(workspace), temporary = `${target}.${crypto.randomUUID()}.tmp`;
  try { await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, { flag: "wx" }); await rename(temporary, target); }
  finally { await rm(temporary, { force: true }).catch(() => undefined); }
}
async function locked<T>(workspace: WorkspaceKey, action: () => Promise<T>): Promise<T> {
  await mkdir(root, { recursive: true });
  const lock = `${fileFor(workspace)}.lock`;
  for (let attempt = 0; attempt < 40; attempt++) {
    let handle;
    try { handle = await open(lock, "wx"); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; await wait(25 + attempt * 5); continue; }
    try { return await action(); }
    finally { await handle.close(); await rm(lock, { force: true }); }
  }
  throw new PrototypeWorkError("state_busy", 503, "Shared prototype work is busy. Refresh and retry.");
}

export function validatePrototypeRecords(workspace: WorkspaceKey, records: unknown): Record<string, unknown>[] {
  if (!Array.isArray(records) || records.length < 1 || records.length > 100
      || records.some((record) => !record || typeof record !== "object" || Array.isArray(record)
        || (record as Record<string, unknown>).workspace !== workspace || typeof (record as Record<string, unknown>).id !== "string"))
    throw new PrototypeWorkError("invalid_records", 400, "The workspace Work Record snapshot is invalid.");
  if (new Set(records.map((record) => (record as Record<string, unknown>).id)).size !== records.length)
    throw new PrototypeWorkError("duplicate_work_id", 400, "The workspace Work Record snapshot contains duplicate identities.");
  return records as Record<string, unknown>[];
}

export async function loadPrototypeWork(workspace: WorkspaceKey) {
  return locked(workspace, async () => {
    const found = await readUnlocked(workspace);
    if (found) return found;
    const created = initial(workspace);
    await writeUnlocked(workspace, created);
    return created;
  });
}

export async function savePrototypeWork(workspace: WorkspaceKey, expectedRevision: number, records: Record<string, unknown>[]) {
  return locked(workspace, async () => {
    const state = await readUnlocked(workspace) ?? initial(workspace);
    if (!Number.isInteger(expectedRevision) || expectedRevision !== state.revision)
      throw new PrototypeWorkError("stale_state", 409, "Another browser changed this workspace. Refresh before saving again.");
    assertSnapshotCommercialIntegrity(state.records, records);
    state.records = records;
    state.revision++;
    await writeUnlocked(workspace, state);
    return state;
  });
}

export async function mutatePrototypeWork(workspace: WorkspaceKey, expectedRevision: number, workId: string, transform: (record: Record<string, unknown>) => Record<string, unknown>) {
  return locked(workspace, async () => {
    const state = await readUnlocked(workspace) ?? initial(workspace);
    if (!Number.isInteger(expectedRevision) || expectedRevision !== state.revision)
      throw new PrototypeWorkError("stale_state", 409, "Another browser changed this workspace. Refresh before deciding.");
    const index = state.records.findIndex((record) => record.id === workId);
    if (index < 0) throw new PrototypeWorkError("work_unavailable", 404, "This Work Record is unavailable in the selected workspace.");
    const next = transform(state.records[index]);
    if (next.id !== workId || next.workspace !== workspace) throw new PrototypeWorkError("invalid_result", 500, "The commercial command changed Work Record identity or workspace.");
    state.records[index] = next;
    state.revision++;
    await writeUnlocked(workspace, state);
    return state;
  });
}
