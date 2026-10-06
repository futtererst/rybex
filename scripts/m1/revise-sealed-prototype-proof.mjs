import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { context, sql, q, command, loadWork } from './implementation-context.mjs';

const plan = JSON.parse(readFileSync('artifacts/d5o-m1-s1-implementation-20260928T004316Z/domain-implementation-20260928-01/FIXTURE-PLAN-8beb15ad.json'));
const sealed = {
  rybex: 'ef995191-a5d7-4f66-9320-1cd67076f447',
  rotork: 'bef9715d-5156-4030-a088-756244d3b3ba'
};
const c = await context();
const results = [];
for (const f of plan.scenarios) {
  const work = sealed[f.name];
  const actor = await c.login(f.actors.preparer.email);
  const before = await loadWork(actor, f, work);
  assert.equal(before.proof.proof_package_revision, 1, `${f.name}: unexpected proof lineage`);
  assert.equal(before.proof.status, 'submitted', `${f.name}: proof is not submitted`);
  const items = JSON.parse(sql(`select coalesce(jsonb_agg(jsonb_build_object('key',requirement_key,'evidenceId',evidence_object_id,'evidenceVersion',evidence_version) order by requirement_key),'[]') from d5o_proof_items where proof_id=${q(before.proof.id)};`));
  assert(items.length, `${f.name}: no evidence to carry into a new proof revision`);
  await command(actor, f, work, 'new_proof');
  for (const item of items) await command(actor, f, work, 'add_evidence', { requirementKey: item.key, evidenceId: item.evidenceId, evidenceVersion: item.evidenceVersion });
  await command(actor, f, work, 'submit_proof');
  const after = await loadWork(actor, f, work);
  assert.equal(after.proof.proof_package_revision, 2);
  assert.equal(after.proof.status, 'submitted');
  assert.equal(after.proof.snapshot.packages.length, 1);
  assert.deepEqual(after.proofRevisions[0].snapshot, before.proof.snapshot, 'historical proof was rewritten');
  assert(!after.blockers.some((entry) => entry.reason === 'proof_revision_stale'));
  results.push({ scenario: f.name, work, revision: 2, status: 'PASS' });
}
console.log(JSON.stringify({ status: 'PASS', results }));
