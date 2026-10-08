import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const disposableRoot = await mkdtemp(path.join(tmpdir(), "d5o-schedule-booking-"));
const originalCwd = process.cwd();

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return { url: "data:text/javascript,export%20%7B%7D", shortCircuit: true };
    if (specifier.startsWith("@/")) return nextResolve(pathToFileURL(path.join(projectRoot, `${specifier.slice(2)}.ts`)).href, context);
    return nextResolve(specifier, context);
  },
});

try {
  process.chdir(disposableRoot);
  const { dateKeyForSchedule, publishedWeekStatus } = await import(pathToFileURL(path.join(projectRoot, "components/d5o/platform/schedule-model.ts")).href);
  const { loadSchedule, mutateSchedule, respondToPublishedBooking } = await import(pathToFileURL(path.join(projectRoot, "lib/d5o/scheduling/store.ts")).href);
  const actor = { id: "synthetic-scheduler", name: "Synthetic Scheduler", role: "project_manager" };
  const initial = await loadSchedule("rybex");
  const source = initial.assignments.find((item) => item.id === "seed-fiber");
  assert.ok(source, "The disposable baseline has a fiber booking");
  const seeded = await mutateSchedule("rybex", actor, { action: "publish", expectedRevision: initial.revision, week: 0 });
  const firstPublication = seeded.publications.at(-1);
  const accepted = await respondToPublishedBooking("rybex", { id: "synthetic-maya", name: "Maya Chen", role: "crew" }, "Maya Chen",
    { expectedRevision: seeded.revision, publicationId: firstPublication.id, assignmentId: "seed-quality", response: "acknowledged" });
  const originalSlot = { date: source.date, shift: source.shift };
  const moved = { ...source, day: 1, date: dateKeyForSchedule(initial.anchorDate, 0, 1), shift: "08:00–16:00" };
  const changed = await mutateSchedule("rybex", actor, { action: "save-booking", expectedRevision: accepted.revision, assignment: moved });
  assert.equal(changed.revision, accepted.revision + 1);
  assert.equal(changed.draftRevision, initial.draftRevision + 1);
  assert.equal(changed.publications.length, seeded.publications.length + 1, "Save creates the worker-visible revision atomically");
  assert.equal(publishedWeekStatus(changed, 0).current, true);
  const secondPublication = changed.publications.at(-1);
  const carried = changed.receipts.find((item) => item.publicationId === secondPublication.id && item.recipient === "Maya Chen");
  assert.equal(carried?.source, "carried", "An unchanged booking retains its worker's acceptance");
  assert.equal(carried?.carriedFromReceiptId, accepted.receipts.at(-1).id);
  assert.equal(changed.receipts.some((item) => item.publicationId === secondPublication.id && item.recipient === "Nate Walker"), false,
    "A changed booking requires a fresh response");
  assert.deepEqual(changed.assignments.find((item) => item.id === source.id), moved);
  const revisedDemand = changed.packageDemands.find((item) => item.packageId === source.packageId);
  assert.deepEqual(revisedDemand.requiredSlots, [{ date: moved.date, shift: moved.shift }]);
  assert.equal((await loadSchedule("rybex")).assignments.find((item) => item.id === source.id).date, moved.date, "Booking survives reload");

  await assert.rejects(() => mutateSchedule("rybex", actor, { action: "save-booking", expectedRevision: initial.revision, assignment: source }), (error) => error.code === "stale_schedule");
  const invalid = { ...moved, shift: "17:00–16:00" };
  await assert.rejects(() => mutateSchedule("rybex", actor, { action: "save-booking", expectedRevision: changed.revision, assignment: invalid }), (error) => error.code === "invalid_assignment");
  assert.equal((await loadSchedule("rybex")).revision, changed.revision, "Rejected changes leave the revision intact");

  const restored = await mutateSchedule("rybex", actor, { action: "save-booking", expectedRevision: changed.revision, assignment: source });
  assert.deepEqual(restored.packageDemands.find((item) => item.packageId === source.packageId).requiredSlots, [originalSlot]);
  assert.deepEqual(restored.assignments.find((item) => item.id === source.id), source);
  const added = { ...source, id: "synthetic-additional-crew", crew: "Fiber support", people: ["Avery Reed", "Mia Owens", "Tomas Bell"], day: 2, date: dateKeyForSchedule(initial.anchorDate, 0, 2), shift: "09:00–16:00" };
  await assert.rejects(() => mutateSchedule("rybex", actor, { action: "save-booking", expectedRevision: restored.revision, assignment: added }), (error) => error.code === "invalid_source_slot");
  const created = await mutateSchedule("rybex", actor, { action: "save-booking", expectedRevision: restored.revision, assignment: added, sourceSlot: originalSlot });
  assert.deepEqual(created.packageDemands.find((item) => item.packageId === source.packageId).requiredSlots,
    [originalSlot, { date: added.date, shift: added.shift }], "The original slot remains required while its first crew is booked");
  assert.deepEqual(created.assignments.find((item) => item.id === added.id), added);
  assert.equal(publishedWeekStatus(created, 0).current, true, "The added calendar booking is shared before Save returns");
  assert.ok(created.publications.at(-1).assignments.some((item) => item.id === added.id));
  const workerResponse = await respondToPublishedBooking("rybex", { id: "synthetic-avery", name: "Avery Reed", role: "crew" }, "Avery Reed",
    { expectedRevision: created.revision, publicationId: created.publications.at(-1).id, assignmentId: added.id, response: "acknowledged" });
  assert.equal(workerResponse.receipts.at(-1).source, "self", "A worker can respond to a booking immediately after Save");
  assert.equal(publishedWeekStatus(workerResponse, 0).current, true, "Worker response does not unpublish the calendar");
  await assert.rejects(() => respondToPublishedBooking("rybex", { id: "synthetic-tomas", name: "Tomas Bell", role: "crew" }, "Tomas Bell",
    { expectedRevision: created.revision, publicationId: created.publications.at(-1).id, assignmentId: added.id, response: "acknowledged" }),
    (error) => error.code === "stale_schedule", "A second worker must refresh after another response advances the revision");
  const refreshedWorkerResponse = await respondToPublishedBooking("rybex", { id: "synthetic-tomas", name: "Tomas Bell", role: "crew" }, "Tomas Bell",
    { expectedRevision: workerResponse.revision, publicationId: created.publications.at(-1).id, assignmentId: added.id, response: "acknowledged" });
  assert.equal(refreshedWorkerResponse.receipts.at(-1).recipient, "Tomas Bell", "The same booking remains answerable after refresh");
  const declined = await respondToPublishedBooking("rybex", { id: "synthetic-mia", name: "Mia Owens", role: "crew" }, "Mia Owens",
    { expectedRevision: refreshedWorkerResponse.revision, publicationId: created.publications.at(-1).id, assignmentId: added.id, response: "cannot-attend" });
  assert.ok(publishedWeekStatus(declined, 0).cannotAttend.some(({ recipient }) => recipient === "Mia Owens"),
    "A worker decline becomes a scheduler attendance action");
  await assert.rejects(() => mutateSchedule("rybex", actor, { action: "publish", expectedRevision: declined.revision, week: 0 }),
    (error) => error.code === "already_published", "There is no second publication step for the saved booking");
  const rotork = await loadSchedule("rotork");
  const pilot = rotork.assignments.find((item) => item.id === "seed-pilot");
  const revisedPilot = { ...pilot, day: 1, date: dateKeyForSchedule(rotork.anchorDate, 0, 1) };
  const rotorkSaved = await mutateSchedule("rotork", actor, { action: "save-booking", expectedRevision: rotork.revision, assignment: revisedPilot });
  assert.equal(publishedWeekStatus(rotorkSaved, 0).current, true, "The same save-and-share contract works for Rotork");
  console.log("PASS: atomic booking/date/shift save and share, unchanged-receipt carry, fresh response for changed work, durable reload, stale rejection, invalid-input rollback, and restoration in a disposable schedule");
} finally {
  process.chdir(originalCwd);
  const expectedParent = path.resolve(tmpdir());
  if (path.dirname(path.resolve(disposableRoot)) !== expectedParent || !path.basename(disposableRoot).startsWith("d5o-schedule-booking-"))
    throw new Error("Disposable test path failed ownership verification.");
  await rm(disposableRoot, { recursive: true, force: true });
}
