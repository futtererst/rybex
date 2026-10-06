import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { context, sql, q, rpc, createWork, loadWork, command, boundary } from './m1/implementation-context.mjs';
import { prepare } from './m1/proof-fixtures.mjs';

const plan = JSON.parse(readFileSync('artifacts/d5o-m1-s1-implementation-20260928T004316Z/domain-implementation-20260928-01/FIXTURE-PLAN-8beb15ad.json'));
const migration = 'supabase/migrations/20261004230000_d5o_work_package_foundation.sql';
const results = [];
const test = async (name, run) => { await run(); results.push({ name, status: 'PASS' }); };
const call = (actor, fixture, work, version, kind, payload, id = randomUUID()) => rpc(actor, 'd5o_execute_work_extension_v1', {
  p_workspace_id: fixture.workspace, p_work_id: work, p_expected_version: version,
  p_command_id: id, p_kind: kind, p_payload: payload
});
const snapshot = (work) => sql(`select jsonb_build_object('work',(select to_jsonb(w) from d5o_work_records w where id=${q(work)}),'packages',(select coalesce(jsonb_agg(to_jsonb(p) order by id),'[]') from d5o_work_packages p where work_id=${q(work)}),'lifecycle',(select coalesce(jsonb_agg(to_jsonb(a) order by id),'[]') from d5o_lifecycle_actions a where work_id=${q(work)}),'audit',(select count(*) from audit_events where entity_id=${q(work)}),'commands',(select count(*) from command_idempotency where entity_id=${q(work)}));`);
const deny = async (work, pattern, run) => { const before = snapshot(work); await assert.rejects(run, pattern); assert.equal(snapshot(work), before, 'denial left authoritative effects'); };

try {
  boundary();
  if (process.argv.includes('--apply')) {
    assert.equal(sql("select to_regclass('public.d5o_work_packages') is null;"), 't', 'migration already applied');
    sql(readFileSync(migration, 'utf8'));
  }
  assert.equal(sql("select to_regclass('public.d5o_work_packages') is not null;"), 't', 'extension migration missing');
  const c = await context();
  for (const f of plan.scenarios) {
    const owner = await c.login(f.actors.preparer.email);
    const other = plan.scenarios.find((candidate) => candidate.workspace !== f.workspace);
    const made = await createWork(owner, f, `Synthetic ${f.name} package extension`);
    const work = made.workId;
    const version = () => Number(sql(`select record_version from d5o_work_records where id=${q(work)};`));
    const first = version();
    await test(`${f.name}: create subordinate package advances record`, async () => {
      await call(owner, f, work, first, 'create_package', { key: 'controlled-unit', name: 'Controlled execution unit' });
      assert.equal(version(), first + 1);
    });
    const packageId = sql(`select id from d5o_work_packages where work_id=${q(work)} and package_key='controlled-unit';`);
    await test(`${f.name}: installed and tested facts persist separately`, async () => {
      await call(owner, f, work, version(), 'record_package_facts', { packageId, installed: 80, tested: 60 });
      const view = await rpc(owner, 'd5o_load_work_extensions_v1', { p_workspace_id: f.workspace, p_work_id: work });
      assert.equal(Number(view.packages[0].installed_percent), 80);
      assert.equal(Number(view.packages[0].tested_percent), 60);
      assert.equal(Number(view.packages[0].accepted_percent), 0);
      assert.equal(view.packages[0].status, 'in_progress');
      assert.equal(view.lifecycleActions.length, 0);
    });
    await test(`${f.name}: stale and invalid facts roll back`, async () => {
      await deny(work, /concurrency_conflict/, () => call(owner, f, work, first, 'record_package_facts', { packageId, installed: 90, tested: 70 }));
      await deny(work, /invalid_package_facts/, () => call(owner, f, work, version(), 'record_package_facts', { packageId, installed: 70, tested: 70 }));
      await deny(work, /invalid_package_facts|check constraint/, () => call(owner, f, work, version(), 'record_package_facts', { packageId, installed: 90, tested: 95 }));
    });
    await test(`${f.name}: lifecycle action is durable and audited`, async () => {
      const before = version();
      await call(owner, f, work, before, 'plan_lifecycle_action', { action: 'Inspect delivered outcome', dueAt: '2026-11-01T12:00:00Z' });
      const view = await rpc(owner, 'd5o_load_work_extensions_v1', { p_workspace_id: f.workspace, p_work_id: work });
      assert.equal(view.lifecycleActions[0].action, 'Inspect delivered outcome');
      assert.equal(view.recordVersion, before + 1);
      assert.match(snapshot(work), /plan_lifecycle_action|Inspect delivered outcome/);
    });
    await test(`${f.name}: replay commits once; acceptance cannot be fabricated`, async () => {
      const id = randomUUID(), expected = version(), payload = { action: 'Follow up after handoff' };
      const original = await call(owner, f, work, expected, 'plan_lifecycle_action', payload, id);
      const before = snapshot(work);
      const replay = await call(owner, f, work, expected, 'plan_lifecycle_action', payload, id);
      assert.equal(replay.replayed, true);
      assert.equal(replay.resourceId, original.resourceId);
      assert.equal(snapshot(work), before);
      await deny(work, /idempotency_mismatch/, () => call(owner, f, work, expected, 'plan_lifecycle_action', { action: 'Different' }, id));
      await deny(work, /unknown_command/, () => call(owner, f, work, version(), 'accept_package', { packageId }));
    });
    await test(`${f.name}: workspace and authority boundaries remain closed`, async () => {
      await deny(work, /forbidden/, () => rpc(owner, 'd5o_execute_work_extension_v1', { p_workspace_id: other.workspace, p_work_id: work, p_expected_version: version(), p_command_id: randomUUID(), p_kind: 'record_package_facts', p_payload: { packageId, installed: 90, tested: 80 } }));
      const auditor = await c.login(f.actors.auditor.email);
      await deny(work, /wrong_authority/, () => call(auditor, f, work, version(), 'record_package_facts', { packageId, installed: 90, tested: 80 }));
      const direct = await owner.from('d5o_work_packages').insert({ workspace_id: f.workspace, work_id: work, package_key: 'bypass', name: 'Bypass' });
      assert(direct.error, 'direct table insert must be denied');
      const foreign = await rpc(owner, 'd5o_load_work_extensions_v1', { p_workspace_id: f.workspace, p_work_id: work });
      assert.equal(foreign.packages.length, 1);
    });
    const main = await loadWork(owner, f, work);
    assert.equal(main.work.record_version, version(), 'M1 aggregate and extension versions diverged');
  }
  await test('completed Work Record cannot receive a new package through the database guard', async () => {
    const closed = JSON.parse(sql("select jsonb_build_object('id',w.id,'workspace',w.workspace_id,'owner',w.owner_profile_id,'actor',w.created_by) from d5o_work_records w where w.lifecycle_state=w.configuration_snapshot->'workType'->'lifecycle_json'->>'completeState' limit 1;"));
    assert(closed?.id, 'a completed synthetic Work Record is required');
    const before = sql(`select count(*) from d5o_work_packages where work_id=${q(closed.id)};`);
    assert.throws(() => sql(`insert into d5o_work_packages(workspace_id,work_id,package_key,name,owner_profile_id,created_by) values(${q(closed.workspace)},${q(closed.id)},${q(randomUUID())},'Invalid closed package',${q(closed.owner)},${q(closed.actor)});`), /work_closed/);
    assert.equal(sql(`select count(*) from d5o_work_packages where work_id=${q(closed.id)};`), before);
  });
  await test('submitted proof freezes packages; new revision snapshots package facts', async () => {
    const f = plan.scenarios[0];
    const p = await prepare(c, f);
    const submitted = JSON.parse(sql(`select snapshot from d5o_proof_packages where work_id=${q(p.work)} and proof_package_revision=1;`));
    const live = JSON.parse(sql(`select rybex_internal.d5o_m1_snapshot(${q(p.work)},(select id from d5o_proof_packages where work_id=${q(p.work)} and proof_package_revision=1));`));
    assert.deepEqual(live, submitted, 'package-free proof changed its historical snapshot');
    await deny(p.work, /proof_revision_required/, () => call(p.owner, f, p.work, Number(sql(`select record_version from d5o_work_records where id=${q(p.work)};`)), 'create_package', { key: 'late-package', name: 'Late package' }));
    await command(p.owner, f, p.work, 'new_proof');
    await call(p.owner, f, p.work, Number(sql(`select record_version from d5o_work_records where id=${q(p.work)};`)), 'create_package', { key: 'revised-package', name: 'Revised package' });
    const current = JSON.parse(sql(`select rybex_internal.d5o_m1_snapshot(${q(p.work)},(select id from d5o_proof_packages where work_id=${q(p.work)} and proof_package_revision=2));`));
    assert.equal(current.packages.length, 1);
    assert.equal(current.packages[0].key, 'revised-package');
    assert.deepEqual(JSON.parse(sql(`select snapshot from d5o_proof_packages where work_id=${q(p.work)} and proof_package_revision=1;`)), submitted);
  });
  console.log(JSON.stringify({ status: 'PASS', assertions: results.length, results }));
} catch (error) {
  console.error(JSON.stringify({ status: 'FAIL', error: error instanceof Error ? error.message : String(error), passed: results.length, results }));
  process.exitCode = 1;
}
