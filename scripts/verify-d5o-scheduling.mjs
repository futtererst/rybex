import assert from "node:assert/strict";
import { applyAvailability, assignmentAssessment, currentScheduleWeek, dateKeyForSchedule, datedAssignments, initialAssignments, initialAvailabilityBlocks, initialPackageDemands, peopleProfiles, personUnavailable, planningMonday, publishedWeekStatus, replacementCandidates, scheduleDemand, scheduleRequirement, shiftHours } from "../components/d5o/platform/schedule-model.ts";

const anchor = "2026-10-05";
assert.equal(planningMonday(new Date(2026, 9, 3)), anchor);
assert.equal(dateKeyForSchedule(anchor, 0, 0), anchor);
assert.equal(dateKeyForSchedule(anchor, 1, 4), "2026-10-16");
assert.equal(dateKeyForSchedule(anchor, 4, 0), "2026-11-02", "DST rollover must not move the booking date");
assert.equal(currentScheduleWeek(anchor, new Date(2026, 9, 12)), 1);
assert.equal(datedAssignments([{ id: "dated", week: 0, day: 1 }], anchor)[0].date, "2026-10-06", "a stored booking date remains stable after the current week advances");

const rybexWork = [
  { id: "rybex-1", title: "Turnover", site: "DC-2", blockers: ["Certification result requires retest"], packages: [{ id: "wp-fibre-rybex-1", name: "Fiber trunks", status: "ready" }] },
  { id: "rybex-3", title: "Monitoring", site: "DC-3", stage: "Planning", owner: "Liam · Delivery manager", blockers: [], packages: [{ id: "wp-monitoring-rybex-3", name: "Monitoring", status: "planned" }] }
];
const rotorkWork = [
  { id: "rotork-1", title: "Pilot", site: "Platform Delta", blockers: ["Pilot review outstanding"], packages: [{ id: "wp-pilot-rotork-1", name: "Paid pilot", status: "ready" }] }
];
const rybex = initialAssignments.rybex;
const rotork = initialAssignments.rotork;

assert.equal(shiftHours("07:00–15:30"), 8);
assert.equal(shiftHours("08:00–16:00"), 7.5);
assert.equal(assignmentAssessment(rybex[0], rybex, "rybex", rybexWork).unqualified.length, 0);
assert.equal(assignmentAssessment(rotork[0], rotork, "rotork", rotorkWork).unqualified.length, 0);
assert.equal(assignmentAssessment(rybex[0], rybex, "rybex", rybexWork).release, "Release held");
assert.equal(assignmentAssessment(rotork[0], rotork, "rotork", rotorkWork).release, "Release held");
assert.equal(assignmentAssessment(rybex[3], rybex, "rybex", rybexWork).decisionOwner, "Liam · Delivery manager");
assert.equal(scheduleRequirement("wp-fibre-rybex-1")?.minimumPeople, 3);
assert.equal(scheduleRequirement("wp-pilot-rotork-1")?.minimumPeople, 3);
assert.equal(scheduleRequirement("wp-rollout-rotork-1")?.crewSchedulable, false, "An authorization package is not a field crew booking target");
const requiredFiber = initialPackageDemands("rybex", anchor).find((item) => item.packageId === "wp-fibre-rybex-1");
assert.deepEqual(requiredFiber?.requiredSlots, [{ date: "2026-10-05", shift: "07:00–15:30" }]);
assert.equal(scheduleDemand(rybexWork, rybex, 1, initialPackageDemands("rybex", anchor), anchor).length, 0, "Required dates do not recur when the calendar advances a week");
assert.match(assignmentAssessment({ ...rybex[0], day: 4, date: "2026-10-09" }, rybex, "rybex", rybexWork).errors.join(" "), /outside the Work Package required dates/);
assert.match(assignmentAssessment({ ...rybex[0], date: anchor, shift: "09:00–16:00" }, rybex, "rybex", rybexWork).errors.join(" "), /booking shift must be/);
const swappedDemand = initialPackageDemands("rybex", anchor).map((item) => item.packageId === requiredFiber?.packageId ? { ...item, requiredSlots: [{ date: "2026-10-09", shift: "09:00–16:00" }] } : item);
assert.match(assignmentAssessment({ ...rybex[0], date: anchor }, rybex, "rybex", rybexWork, undefined, swappedDemand).errors.join(" "), /outside the Work Package required dates/);
assert.equal(assignmentAssessment({ ...rybex[0], day: 4, date: "2026-10-09", shift: "09:00–16:00" }, rybex, "rybex", rybexWork, undefined, swappedDemand).errors.length, 0, "The same evaluator follows edited package dates and shifts");
const serviceDemand = initialPackageDemands("rybex", anchor).map((item) => item.packageId === "wp-service-rybex-3" ? { ...item, requiredSlots: [{ date: "2026-10-08", shift: "07:00–15:30" }, { date: "2026-10-09", shift: "09:00–16:00" }] } : item);
const serviceWork = [{ id: "rybex-3", title: "Monitoring", site: "DC-3", blockers: [], packages: [{ id: "wp-service-rybex-3", name: "Service integration", status: "planned" }] }];
assert.deepEqual(scheduleDemand(serviceWork, [], 0, serviceDemand, anchor).map((item) => `${item.date}|${item.shift}`), ["2026-10-08|07:00–15:30", "2026-10-09|09:00–16:00"], "Each required date and shift creates a separate staffing need");
assert.equal(scheduleDemand(rybexWork, rybex, 0).find((item) => item.packageId === "wp-fibre-rybex-1")?.remainingPersonHours, 0);
assert.equal(scheduleDemand(rybexWork, rybex, 0).find((item) => item.packageId === "wp-monitoring-rybex-3")?.remainingPersonHours, 1);
assert.equal(scheduleDemand(rotorkWork, rotork, 0).find((item) => item.packageId === "wp-pilot-rotork-1")?.remainingPersonHours, 0);
const rotorkDecisionWork = [{ id: "rotork-1", title: "Modernization", site: "Platform Delta", blockers: [], packages: [{ id: "wp-rollout-rotork-1", name: "Rollout authorization package", status: "planned" }] }];
assert.equal(scheduleDemand(rotorkDecisionWork, rotork, 0).length, 0, "Decision packages cannot appear as unstaffed field work");
const unauthorizedCrewBooking = { ...rotork[0], id: "new-auth-booking", packageId: "wp-rollout-rotork-1", day: 3, people: ["Harper Singh", "Noah James", "Aisha Brown"] };
assert.match(assignmentAssessment(unauthorizedCrewBooking, rotork, "rotork", rotorkDecisionWork).errors.join(" "), /authorization package, not crew execution work/);
assert.equal(assignmentAssessment(rotork[2], rotork, "rotork", [{ ...rotorkDecisionWork[0], id: "rotork-3", packages: [{ id: "wp-rollout-rotork-3", name: "Rollout authorization package", status: "accepted" }] }]).errors.length, 0, "Historical accepted booking remains readable");
const profiles = applyAvailability(peopleProfiles.rybex, initialAvailabilityBlocks.rybex);
assert.equal(personUnavailable(profiles.find((person) => person.name === "Mia Owens"), 0, 3), "Approved leave");

const moved = { ...rybex[0], day: 1, date: "2026-10-06" };
assert.match(assignmentAssessment(moved, rybex, "rybex", rybexWork).errors.join(" "), /outside the Work Package required dates/);
assert.match(assignmentAssessment({ ...moved, people: ["Nate Walker"] }, rybex, "rybex", rybexWork).errors.join(" "), /at least 3 qualified people/);
assert.match(assignmentAssessment({ ...moved, day: 4, date: "2026-10-09" }, rybex, "rybex", rybexWork).errors.join(" "), /outside the Work Package required dates/);
const availableWork = [{ id: "rybex-2", title: "Retrofit", site: "DC-1", blockers: [], packages: [{ id: "wp-fibre-rybex-2", name: "Fiber package", status: "planned" }] }];
const absent = { ...rybex[0], id: "new-absence", workId: "rybex-2", packageId: "wp-fibre-rybex-2", people: ["Mia Owens", "Nate Walker"], day: 3 };
assert.match(assignmentAssessment(absent, rybex, "rybex", availableWork).errors.join(" "), /Unavailable on Thu: Mia Owens/);
assert.equal(replacementCandidates(absent, "Mia Owens", rybex, "rybex", availableWork).some((person) => person.name === "Mia Owens"), false);
assert.equal(assignmentAssessment(absent, rybex, "rybex", availableWork, applyAvailability(peopleProfiles.rybex, [])).unavailablePeople.length, 0, "removing an availability block clears its conflict");
const newlyBlocked = applyAvailability(peopleProfiles.rybex, [{ id: "test", person: "Nate Walker", week: 0, day: 0, reason: "Training" }]);
assert.match(assignmentAssessment(rybex[0], rybex, "rybex", rybexWork, newlyBlocked).errors.join(" "), /Unavailable on Mon: Nate Walker/);
assert.equal(rybex[0].day, 0, "a proposed move must not mutate the source assignment");

const overlap = { ...rybex[0], id: "new-overlap", people: ["Nate Walker"] };
assert.match(assignmentAssessment(overlap, rybex, "rybex", rybexWork).errors.join(" "), /Already scheduled/);
assert.match(assignmentAssessment(overlap, rybex, "rybex", rybexWork).issues.find((issue) => issue.kind === "overlap")?.message ?? "", /Nate Walker.*Fiber installation.*Mon 07:00–15:30/);
assert.ok(replacementCandidates(overlap, "Nate Walker", rybex, "rybex", rybexWork).some((person) => person.name === "Mia Owens"));

const wrongSkill = { ...rybex[0], id: "new-skill", people: ["Maya Chen"], day: 4 };
assert.match(assignmentAssessment(wrongSkill, rybex, "rybex", rybexWork).errors.join(" "), /Qualification missing/);
assert.match(assignmentAssessment(wrongSkill, rybex, "rybex", rybexWork).issues.find((issue) => issue.kind === "qualification")?.message ?? "", /Maya Chen.*Fiber installation/);
assert.ok(replacementCandidates(wrongSkill, "Maya Chen", rybex, "rybex", rybexWork).some((person) => person.name === "Nate Walker"));

const extra = [1, 2, 3, 4].map((day) => ({ ...rybex[0], id: `extra-${day}`, day, people: ["Nate Walker"] }));
const overCapacity = { ...rybex[0], id: "new-capacity", day: 4, people: ["Nate Walker"] };
assert.match(assignmentAssessment(overCapacity, [...rybex, ...extra], "rybex", rybexWork).errors.join(" "), /Weekly capacity exceeded/);
assert.match(assignmentAssessment(overCapacity, [...rybex, ...extra], "rybex", rybexWork).issues.find((issue) => issue.kind === "capacity")?.message ?? "", /Nate Walker.*48h.*40h/);

const unconfigured = { ...rybex[0], id: "new-unconfigured", packageId: "new-package", day: 4 };
assert.match(assignmentAssessment(unconfigured, rybex, "rybex", rybexWork).errors.join(" "), /No qualification requirement/);
assert.equal(replacementCandidates(unconfigured, "Nate Walker", rybex, "rybex", rybexWork).length, 0);

const acceptedWork = [{ ...rybexWork[0], packages: [{ ...rybexWork[0].packages[0], status: "accepted" }] }];
assert.equal(assignmentAssessment(rybex[0], rybex, "rybex", acceptedWork).release, "Package complete");
assert.equal(assignmentAssessment(rybex[0], rybex, "rybex", acceptedWork).errors.length, 0, "historical assignment remains visible");
assert.match(assignmentAssessment({ ...rybex[0], day: 1 }, rybex, "rybex", acceptedWork).errors.join(" "), /package is accepted/);
assert.match(assignmentAssessment({ ...rybex[0], id: "new-accepted" }, rybex, "rybex", acceptedWork).errors.join(" "), /package is accepted/);

const published = { id: "publication-1", week: 0, weekStart: anchor, draftRevision: 2, publishedAt: "2026-10-03T12:00:00Z", publishedBy: { id: "scheduler", name: "Scheduler", role: "coordinator" }, assignments: [rybex[0]] };
const declined = { id: "receipt-1", publicationId: published.id, assignmentId: rybex[0].id, recipient: "Avery Reed", recordedAt: "2026-10-03T13:00:00Z", recordedBy: { id: "avery", name: "Avery Reed", role: "crew" }, statement: "Cannot attend", source: "self", response: "cannot-attend" };
const source = { schemaVersion: 1, workspace: "rybex", anchorDate: anchor, revision: 3, draftRevision: 2, assignments: rybex, availabilityBlocks: [], publications: [published], receipts: [declined] };
assert.equal(publishedWeekStatus(source, 0).cannotAttend.length, 1);
assert.equal(publishedWeekStatus(source, 0).awaiting.length, 2);
const revisedDraft = { ...source, draftRevision: 3, assignments: rybex.map((item) => item.id === rybex[0].id ? { ...item, people: item.people.map((name) => name === "Avery Reed" ? "Mia Owens" : name) } : item) };
assert.equal(publishedWeekStatus(revisedDraft, 0).current, false, "Draft replacement must not erase the old published response");
assert.equal(publishedWeekStatus(revisedDraft, 0).cannotAttend[0].recipient, "Avery Reed");
const republished = { ...revisedDraft, publications: [published, { ...published, id: "publication-2", draftRevision: 3, assignments: [revisedDraft.assignments[0]] }] };
assert.equal(publishedWeekStatus(republished, 0).cannotAttend.length, 0, "New publication starts a fresh receipt cycle");
assert.equal(publishedWeekStatus(republished, 0).awaiting.length, 3);

console.log("D5O scheduling contract: explicit package dates/shifts, availability, crew size, qualification, capacity, move, release, and both workspaces PASS");
