import assert from 'node:assert/strict';
import { assessDefine } from '../components/d5o/platform/define-readiness.ts';

const work = { discovery: { pursuitControl: { handoff: { status: 'accepted' } } } };
const definition = {
  project: { customerContact: 'Facilities lead', siteArea: 'DC-3', affectedSystems: 'Generator telemetry', accessConstraints: 'Approved access window' },
  findings: [{ status: 'Confirmed', source: 'Survey S-1', detail: '12 points identified' }], clarifications: [], excludedScope: 'Network changes by customer',
  scopeControl: { requirements: [{ id: 'r1', need: 'Alarm visibility', source: 'Survey S-1', owner: 'Architect', state: 'Confirmed' }], interfaces: [{ id: 'i1', kind: 'Technical', boundary: 'BMS gateway', owner: 'Rybex', counterparty: 'Customer IT', agreement: 'Meeting M-1' }], assumptions: [], customerAgreement: { representative: 'Facilities lead', agreedAt: '2026-10-07', basis: 'Meeting M-1' } },
  registers: { scope_items: [{ id: 's1', requirementId: 'r1', deliverable: 'Monitoring', boundary: 'Gateway', owner: 'Rybex' }], acceptance_criteria: [{ id: 'a1', scopeId: 's1', result: 'Alarm displayed', method: 'Witness test', proof: 'Test report', authority: 'Facilities lead' }] },
};
const assess = (patch = {}, rules = []) => assessDefine(work, { ...definition, ...patch }, 'published-1', rules);
assert.equal(assess().status, 'Ready for review');
assert.match(assess().policy, /published-1/);
assert.equal(assess({ scopeControl: { ...definition.scopeControl, requirements: [{ ...definition.scopeControl.requirements[0], state: 'Open' }] } }).next?.key, 'requirements');
assert.equal(assess({ registers: { ...definition.registers, acceptance_criteria: [] } }).checks.find((item) => item.key === 'acceptance')?.met, false);
assert.equal(assess({ registers: { ...definition.registers, acceptance_criteria: [...definition.registers.acceptance_criteria, { id: 'a2', scopeId: 'missing', result: 'X', method: 'Y', proof: 'Z', authority: 'A' }] } }).checks.find((item) => item.key === 'acceptance')?.met, false);
assert.equal(assess({ scopeControl: { ...definition.scopeControl, assumptions: [{ id: 'a', statement: 'Customer access', owner: 'Customer', source: 'Meeting M-1', state: 'Open' }] } }).checks.find((item) => item.key === 'assumptions')?.met, false);
assert.equal(assess({ scopeControl: { ...definition.scopeControl, customerAgreement: undefined } }).checks.find((item) => item.key === 'agreement')?.met, false);
assert.equal(assess({}, ['Pinned rule unmet']).checks.find((item) => item.key === 'configuration')?.met, false);
assert.equal(assessDefine(work, definition, 'unavailable', []).checks.find((item) => item.key === 'configuration')?.met, false);
assert.equal(assessDefine({ discovery: { pursuitControl: { handoff: { status: 'submitted' } } } }, definition, 'published-1', []).checks[0].met, false);
console.log('PASS: Define traceability, open assumptions, agreement, pinned rules, and handoff basis');
