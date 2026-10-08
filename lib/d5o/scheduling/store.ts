import "server-only";
import { mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { applyAvailability, assignmentAssessment, dateKeyForSchedule, datedAssignments, datedAvailability, initialAssignments, initialAvailabilityBlocks, initialPackageDemands, peopleProfiles, planningMonday, reconcileBookingDemand, scheduleRequirement, shiftHours, type Assignment, type AvailabilityBlock, type CrewDemandSlot, type PackageCrewDemand, type ScheduleActor, type SharedSchedule, type WorkspaceKey } from "@/components/d5o/platform/schedule-model";
import { hasCatalogPackage } from "@/lib/d5o/work-catalog/store";

const root = path.join(process.cwd(), ".rybexos-local", "d5o-shared-schedule-v1");
const fileFor = (workspace: WorkspaceKey) => path.join(root, `${workspace}.json`);
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
export class ScheduleError extends Error { constructor(public code: string, public status: number, message: string) { super(message); } }

function initial(workspace: WorkspaceKey): SharedSchedule {
  const anchorDate = planningMonday();
  return { schemaVersion: 1, workspace, anchorDate, revision: 1, draftRevision: 1,
    assignments: datedAssignments(initialAssignments[workspace], anchorDate),
    availabilityBlocks: datedAvailability(initialAvailabilityBlocks[workspace], anchorDate), publications: [], receipts: [],
    packageDemands: initialPackageDemands(workspace, anchorDate) };
}
async function readUnlocked(workspace: WorkspaceKey): Promise<SharedSchedule | null> {
  let raw: string;
  try { raw = await readFile(fileFor(workspace), "utf8"); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
  let state: SharedSchedule;
  try { state = JSON.parse(raw) as SharedSchedule; } catch { throw new ScheduleError("invalid_state", 500, "Shared schedule cannot be parsed."); }
  if (state.schemaVersion !== 1 || state.workspace !== workspace || !/^\d{4}-\d{2}-\d{2}$/.test(state.anchorDate)
      || !Number.isInteger(state.revision) || !Number.isInteger(state.draftRevision)
      || !Array.isArray(state.assignments) || !Array.isArray(state.availabilityBlocks)
      || !Array.isArray(state.publications) || !Array.isArray(state.receipts))
    throw new ScheduleError("invalid_state", 500, "Shared schedule needs administrator review.");
  if (!Array.isArray(state.packageDemands) || state.packageDemands.some((demand) => !Array.isArray(demand.requiredSlots))) {
    // Convert earlier prototype windows to concrete demand slots once; preserve the exact prior file.
    type LegacyDemand = PackageCrewDemand & { requiredStartDate?: string; requiredEndDate?: string; requiredShifts?: string[] };
    const previous: LegacyDemand[] = Array.isArray(state.packageDemands) ? state.packageDemands as LegacyDemand[] : initialPackageDemands(workspace, state.anchorDate);
    state.packageDemands = previous.map((entry) => {
      const bookings = state.assignments.filter((item) => item.packageId === entry.packageId);
      const slots = bookings.length ? bookings.map((item) => ({ date: item.date ?? dateKeyForSchedule(state.anchorDate, item.week, item.day), shift: item.shift }))
        : Array.isArray(entry.requiredSlots) ? entry.requiredSlots
        : [{ date: entry.requiredStartDate ?? dateKeyForSchedule(state.anchorDate, 0, 0), shift: entry.requiredShifts?.[0] ?? "07:00–15:30" }];
      const { requiredStartDate: _start, requiredEndDate: _end, requiredShifts: _shifts, ...base } = entry;
      void _start; void _end; void _shifts;
      return { ...base, requiredSlots: slots.filter((slot, index) => slots.findIndex((other) => other.date === slot.date && other.shift === slot.shift) === index) };
    });
    try { await writeFile(`${fileFor(workspace)}.pre-package-slots.json`, raw, { flag: "wx" }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
    await writeUnlocked(workspace, state);
  }
  return state;
}
async function writeUnlocked(workspace: WorkspaceKey, state: SharedSchedule) {
  const target = fileFor(workspace);
  const temporary = `${target}.${crypto.randomUUID()}.tmp`;
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
  throw new ScheduleError("schedule_busy", 503, "The shared schedule is busy. Refresh and retry.");
}
export async function loadSchedule(workspace: WorkspaceKey) {
  return locked(workspace, async () => { const state = await readUnlocked(workspace); if (state) return state; const created = initial(workspace); await writeUnlocked(workspace, created); return created; });
}
function cleanAssignment(value: unknown, workspace: WorkspaceKey, anchor: string, demands: PackageCrewDemand[]): Assignment {
  const item = value as Assignment;
  const names = new Set(peopleProfiles[workspace].map((person) => person.name));
  if (!item || typeof item.id !== "string" || !/^[\w-]{1,100}$/.test(item.id) || typeof item.crew !== "string" || !item.crew.trim() || item.crew.length > 100
      || !Array.isArray(item.people) || !item.people.length || new Set(item.people).size !== item.people.length || item.people.some((name) => !names.has(name))
      || !Number.isInteger(item.week) || Math.abs(item.week) > 260 || !Number.isInteger(item.day) || item.day < 0 || item.day > 4
      || item.date !== dateKeyForSchedule(anchor, item.week, item.day) || typeof item.workId !== "string" || !item.workId.startsWith(`${workspace}-`)
      || typeof item.packageId !== "string" || !demands.some((demand) => demand.packageId === item.packageId && demand.workId === item.workId)
      || typeof item.shift !== "string" || shiftHours(item.shift) <= 0)
    throw new ScheduleError("invalid_assignment", 400, "Booking has an invalid scope, date, person, shift, or package.");
  return { id: item.id, crew: item.crew.trim(), people: item.people, workId: item.workId, packageId: item.packageId, week: item.week, day: item.day, date: item.date, shift: item.shift };
}
function cleanAvailability(value: unknown, workspace: WorkspaceKey, anchor: string): AvailabilityBlock {
  const item = value as AvailabilityBlock;
  if (!item || typeof item.id !== "string" || !/^[\w-]{1,100}$/.test(item.id) || !peopleProfiles[workspace].some((person) => person.name === item.person)
      || !Number.isInteger(item.week) || Math.abs(item.week) > 260 || !Number.isInteger(item.day) || item.day < 0 || item.day > 4
      || item.date !== dateKeyForSchedule(anchor, item.week, item.day) || typeof item.reason !== "string" || !item.reason.trim() || item.reason.length > 200)
    throw new ScheduleError("invalid_availability", 400, "Availability has an invalid person, date, or reason.");
  return { id: item.id, person: item.person, week: item.week, day: item.day, date: item.date, reason: item.reason.trim() };
}
function sameAssignment(left: Assignment, right: Assignment | undefined) {
  return Boolean(right && left.id === right.id && left.crew === right.crew && left.workId === right.workId && left.packageId === right.packageId
    && left.week === right.week && left.day === right.day && left.date === right.date && left.shift === right.shift
    && left.people.length === right.people.length && left.people.every((person, index) => person === right.people[index]));
}
function planningErrors(workspace: WorkspaceKey, assignments: Assignment[], availability: AvailabilityBlock[], demands: PackageCrewDemand[], changedIds?: Set<string>) {
  const decisionOnlyChange = assignments.find((item) => changedIds?.has(item.id) && demands.find((demand) => demand.packageId === item.packageId)?.crewSchedulable === false);
  if (decisionOnlyChange) return ["This is an authorization package, not crew execution work. Schedule a field Work Package after the required authorization."];
  const profiles = applyAvailability(peopleProfiles[workspace], availability);
  const work = [...new Set(assignments.map((item) => item.workId))].map((workId) => ({
    id: workId, title: workId, site: "", blockers: [],
    packages: assignments.filter((item) => item.workId === workId).map((item) => ({ id: item.packageId, name: item.packageId, status: "in progress" as const }))
  }));
  return assignments.filter((item) => !changedIds || changedIds.has(item.id)).flatMap((item) => assignmentAssessment(item, assignments, workspace, work, profiles, demands).errors);
}
function publishWeek(state: SharedSchedule, actor: ScheduleActor, week: number): boolean {
  const assignments = state.assignments.filter((item) => item.week === week);
  const previous = state.publications.filter((item) => item.week === week).at(-1);
  if (previous && JSON.stringify(previous.assignments) === JSON.stringify(assignments)) return false;
  const errors = planningErrors(state.workspace, state.assignments, state.availabilityBlocks, state.packageDemands);
  if (errors.length) throw new ScheduleError("schedule_conflict", 409, `Resolve planning conflicts before sharing: ${errors[0]}`);
  const publication = { id: crypto.randomUUID(), week, weekStart: dateKeyForSchedule(state.anchorDate, week, 0),
    draftRevision: state.draftRevision, publishedAt: new Date().toISOString(), publishedBy: actor,
    assignments: structuredClone(assignments),
    packageDemands: structuredClone(state.packageDemands.filter((demand) => assignments.some((item) => item.packageId === demand.packageId))) };
  if (previous) for (const assignment of assignments) {
    const prior = previous.assignments.find((item) => item.id === assignment.id);
    if (!prior || !sameAssignment(assignment, prior)) continue;
    for (const recipient of assignment.people) {
      const receipt = state.receipts.find((item) => item.publicationId === previous.id && item.assignmentId === assignment.id && item.recipient === recipient);
      if (receipt) state.receipts.push({ ...receipt, id: crypto.randomUUID(), publicationId: publication.id,
        source: "carried", carriedFromReceiptId: receipt.id,
        statement: "The worker's previous response remains valid because this booking did not change in the revised schedule." });
    }
  }
  state.publications.push(publication);
  return true;
}
function cleanDemand(value: unknown, workspace: WorkspaceKey): PackageCrewDemand {
  const item = value as PackageCrewDemand;
  const validDate = (date: unknown) => typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(`${date}T12:00:00Z`))
    && new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) === date && ![0, 6].includes(new Date(`${date}T12:00:00Z`).getUTCDay());
  const existing = item && typeof item.packageId === "string" ? scheduleRequirement(item.packageId) : null;
  if (!item || typeof item.workId !== "string" || !/^\w+-\w+$/.test(item.workId) || !item.workId.startsWith(`${workspace}-`)
    || typeof item.packageId !== "string" || !/^wp-[\w-]{1,90}$/.test(item.packageId)
    || existing?.crewSchedulable === false || item.crewSchedulable !== true
    || !peopleProfiles[workspace].some((person) => person.qualifications.includes(item.qualification))
    || !Number.isInteger(item.minimumPeople) || item.minimumPeople < 1 || item.minimumPeople > 20
    || !Number.isFinite(item.estimatedPersonHours) || item.estimatedPersonHours < 0 || item.estimatedPersonHours > 10000
    || !Array.isArray(item.requiredSlots) || !item.requiredSlots.length || item.requiredSlots.length > 50
    || item.requiredSlots.some((slot) => !slot || !validDate(slot.date) || typeof slot.shift !== "string" || shiftHours(slot.shift) <= 0 || shiftHours(slot.shift) > 16)
    || new Set(item.requiredSlots.map((slot) => `${slot.date}|${slot.shift}`)).size !== item.requiredSlots.length
    || !["Critical", "High", "Normal"].includes(item.priority) || typeof item.prerequisite !== "string" || item.prerequisite.length > 300)
    throw new ScheduleError("invalid_demand", 400, "Work Package demand needs scoped, unique required date-and-shift slots, qualification and crew size.");
  return { packageId: item.packageId, workId: item.workId, qualification: item.qualification, minimumPeople: item.minimumPeople,
    estimatedPersonHours: item.estimatedPersonHours, priority: item.priority, prerequisite: item.prerequisite,
    crewSchedulable: true, requiredSlots: [...item.requiredSlots].sort((a, b) => a.date.localeCompare(b.date) || a.shift.localeCompare(b.shift)) };
}
export type ScheduleMutation =
  | { action: "save-assignments"; expectedRevision: number; assignments: Assignment[] }
  | { action: "save-booking"; expectedRevision: number; assignment: Assignment; sourceSlot?: CrewDemandSlot }
  | { action: "save-availability"; expectedRevision: number; availabilityBlocks: AvailabilityBlock[] }
  | { action: "save-demand"; expectedRevision: number; demand: PackageCrewDemand }
  | { action: "publish"; expectedRevision: number; week: number };
export type CrewResponseMutation = { expectedRevision: number; publicationId: string; assignmentId: string; response: "acknowledged" | "cannot-attend" };
export async function mutateSchedule(workspace: WorkspaceKey, actor: ScheduleActor, input: ScheduleMutation): Promise<SharedSchedule> {
  return locked(workspace, async () => {
    const state = await readUnlocked(workspace) ?? initial(workspace);
    const changed = await applyScheduleMutation(state, workspace, actor, input,
      (workId, packageId) => hasCatalogPackage(workspace, workId, packageId));
    if (changed) await writeUnlocked(workspace, state);
    return state;
  });
}

export function initialHostedSchedule(workspace: WorkspaceKey): SharedSchedule {
  return { ...initial(workspace), revision: 0 };
}

/** Shared scheduling rules; persistence and package lookup are supplied by the caller. */
export async function applyScheduleMutation(state: SharedSchedule, workspace: WorkspaceKey,
  actor: ScheduleActor, input: ScheduleMutation,
  hasPackage: (workId: string, packageId: string) => Promise<boolean>): Promise<boolean> {
    if (!Number.isInteger(input.expectedRevision) || state.revision !== input.expectedRevision)
      throw new ScheduleError("stale_schedule", 409, "Another session changed the schedule. Refresh before saving.");
    if (input.action === "save-booking") {
      const booking = cleanAssignment(input.assignment, workspace, state.anchorDate, state.packageDemands);
      const previous = state.assignments.find((item) => item.id === booking.id);
      if (previous && (previous.workId !== booking.workId || previous.packageId !== booking.packageId))
        throw new ScheduleError("booking_scope_changed", 409, "A booking cannot be moved to another Work Record or package.");
      const demand = state.packageDemands.find((item) => item.workId === booking.workId && item.packageId === booking.packageId);
      if (!demand) throw new ScheduleError("demand_unavailable", 409, "The Work Package has no schedulable demand.");
      const source = previous ? { date: previous.date!, shift: previous.shift } : input.sourceSlot;
      if (!source || (!previous && !demand.requiredSlots.some((slot) => slot.date === source.date && slot.shift === source.shift)))
        throw new ScheduleError("invalid_source_slot", 409, "Choose an existing required date and shift before changing this booking.");
      const remaining = state.assignments.filter((item) => item.id !== booking.id);
      const revisedDemand = cleanDemand(reconcileBookingDemand(demand, source, booking, remaining), workspace);
      const nextDemands = [...state.packageDemands.filter((item) => item.packageId !== demand.packageId), revisedDemand];
      const nextAssignments = previous ? state.assignments.map((item) => item.id === booking.id ? booking : item) : [...state.assignments, booking];
      const errors = planningErrors(workspace, nextAssignments, state.availabilityBlocks, nextDemands, new Set([booking.id]));
      if (errors.length) throw new ScheduleError("schedule_conflict", 409, `Resolve planning conflicts before saving: ${errors[0]}`);
      if (previous && sameAssignment(booking, previous) && JSON.stringify(revisedDemand.requiredSlots) === JSON.stringify(demand.requiredSlots)) return false;
      state.assignments = nextAssignments;
      state.packageDemands = nextDemands;
      state.draftRevision++;
      if (previous && previous.week !== booking.week) publishWeek(state, actor, previous.week);
      publishWeek(state, actor, booking.week);
    } else if (input.action === "save-assignments") {
      if (!Array.isArray(input.assignments) || input.assignments.length > 500) throw new ScheduleError("invalid_assignment", 400, "Invalid bookings.");
      const items = input.assignments.map((item) => cleanAssignment(item, workspace, state.anchorDate, state.packageDemands));
      if (new Set(items.map((item) => item.id)).size !== items.length) throw new ScheduleError("duplicate_assignment", 400, "Duplicate booking identity.");
      const changed = new Set(items.filter((item) => !sameAssignment(item, state.assignments.find((previous) => previous.id === item.id))).map((item) => item.id));
      const errors = planningErrors(workspace, items, state.availabilityBlocks, state.packageDemands, changed);
      if (errors.length) throw new ScheduleError("schedule_conflict", 409, `Resolve planning conflicts before saving: ${errors[0]}`);
      const affectedWeeks = [...new Set([...state.assignments, ...items].map((item) => item.week))];
      state.assignments = items; state.draftRevision++;
      for (const week of affectedWeeks) publishWeek(state, actor, week);
    } else if (input.action === "save-availability") {
      if (!Array.isArray(input.availabilityBlocks) || input.availabilityBlocks.length > 500) throw new ScheduleError("invalid_availability", 400, "Invalid availability.");
      const items = input.availabilityBlocks.map((item) => cleanAvailability(item, workspace, state.anchorDate));
      if (new Set(items.map((item) => item.id)).size !== items.length) throw new ScheduleError("duplicate_availability", 400, "Duplicate availability identity.");
      state.availabilityBlocks = items; state.draftRevision++;
    } else if (input.action === "save-demand") {
      const demand = cleanDemand(input.demand, workspace);
      const previous = state.packageDemands.find((item) => item.packageId === demand.packageId);
      if (!previous && !(await hasPackage(demand.workId, demand.packageId)))
        throw new ScheduleError("package_unavailable", 404, "The Work Package must exist in the shared Work Record before crew demand can be saved.");
      if (previous && previous.workId !== demand.workId) throw new ScheduleError("demand_scope_changed", 409, "A Work Package cannot be moved to another Work Record by changing crew demand.");
      if (previous && (Object.keys(demand) as (keyof PackageCrewDemand)[]).every((key) => JSON.stringify(previous[key]) === JSON.stringify(demand[key]))) return false;
      state.packageDemands = [...state.packageDemands.filter((item) => item.packageId !== demand.packageId), demand];
      state.draftRevision++;
    } else if (input.action === "publish") {
      if (!Number.isInteger(input.week) || Math.abs(input.week) > 260) throw new ScheduleError("invalid_week", 400, "Invalid publication week.");
      const assignments = state.assignments.filter((item) => item.week === input.week);
      if (!assignments.length) throw new ScheduleError("empty_schedule", 400, "Add bookings before publishing this week.");
      if (state.publications.some((item) => item.week === input.week && item.draftRevision === state.draftRevision))
        throw new ScheduleError("already_published", 409, "This draft revision is already published.");
      if (!publishWeek(state, actor, input.week)) throw new ScheduleError("already_published", 409, "These bookings are already shared with workers.");
    } else throw new ScheduleError("invalid_action", 400, "Only an assigned worker can respond to a published booking.");
    state.revision++;
    return true;
}

/** Only the signed-in, explicitly bound crew account can make a first-person response. */
export async function respondToPublishedBooking(workspace: WorkspaceKey, actor: ScheduleActor, person: string, input: CrewResponseMutation): Promise<SharedSchedule> {
  return locked(workspace, async () => {
    const state = await readUnlocked(workspace);
    if (!state) throw new ScheduleError("schedule_unavailable", 404, "No shared schedule exists for this workspace.");
    applyCrewResponse(state, actor, person, input);
    await writeUnlocked(workspace, state);
    return state;
  });
}

/** Shared validation for file-backed and hosted worker responses. */
export function applyCrewResponse(state: SharedSchedule, actor: ScheduleActor, person: string, input: CrewResponseMutation): SharedSchedule {
    if (!Number.isInteger(input.expectedRevision) || input.expectedRevision !== state.revision)
      throw new ScheduleError("stale_schedule", 409, "The schedule changed. Refresh before responding.");
    if (input.response !== "acknowledged" && input.response !== "cannot-attend")
      throw new ScheduleError("invalid_response", 400, "Choose a valid response.");
    const publication = state.publications.find((item) => item.id === input.publicationId);
    const booking = publication?.assignments.find((item) => item.id === input.assignmentId);
    if (!publication || !booking || !booking.people.includes(person))
      throw new ScheduleError("invalid_booking", 403, "This published booking is not assigned to your account.");
    const latest = state.publications.filter((item) => item.week === publication.week).at(-1);
    if (latest?.id !== publication.id)
      throw new ScheduleError("superseded_publication", 409, "This publication was superseded. Review the latest plan.");
    if (state.receipts.some((item) => item.publicationId === publication.id && item.assignmentId === booking.id && item.recipient === person))
      throw new ScheduleError("response_exists", 409, "A response is already recorded for this booking.");
    state.receipts.push({ id: crypto.randomUUID(), publicationId: publication.id, assignmentId: booking.id, recipient: person,
      recordedAt: new Date().toISOString(), recordedBy: actor, source: "self", response: input.response,
      statement: input.response === "acknowledged" ? "Assigned crew member acknowledged this published booking while signed in."
        : "Assigned crew member reported they cannot attend this published booking while signed in; scheduler action required." });
    state.revision++;
    return state;
}
