import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sql, q } from "./implementation-context.mjs";

const path = "supabase/migrations/20261005122038_d5o_configured_lifecycle_rules.sql";
const source = readFileSync(path, "utf8");
assert.match(source, /\bbegin;\s*$/m);
assert.match(source, /\bcommit;\s*$/m);
const body = source.replace(/\bbegin;\s*$/m, "").replace(/\bcommit;\s*$/m, "");
const definitions = "select md5(pg_get_functiondef('rybex_internal.d5o_m1_rule_shape(jsonb,integer)'::regprocedure)"
  + "||pg_get_functiondef('rybex_internal.d5o_m1_evaluate(jsonb,uuid,uuid,jsonb,jsonb)'::regprocedure));";
const before = sql(definitions);
const work = sql("select id from public.d5o_work_records order by created_at limit 1;");
assert(work, "a disposable baseline Work Record is required");
const state = sql("select lifecycle_state from public.d5o_work_records where id=" + q(work) + "::uuid;");
const snapshot = "'{\"facts\":[],\"evidence\":[]}'::jsonb";
const matchingRule = q(JSON.stringify({ op: "state_equals", value: state })) + "::jsonb";
const wrongRule = "'{\"op\":\"state_equals\",\"value\":\"a-state-that-does-not-exist\"}'::jsonb";
const missingRule = "'{\"op\":\"decision_recorded_prior\",\"right\":\"not-a-right\",\"outcome\":\"not-an-outcome\"}'::jsonb";
const evaluate = (rule) => "rybex_internal.d5o_m1_evaluate(" + rule + "," + q(work) + "::uuid,null," + snapshot + ",'{}'::jsonb)";
const query = "select jsonb_build_object('matchingState'," + evaluate(matchingRule)
  + ",'wrongState'," + evaluate(wrongRule) + ",'priorDecision'," + evaluate(missingRule) + ");";
const result = JSON.parse(sql("begin; " + body + query + " rollback;"));
assert.deepEqual(result.matchingState, []);
assert.equal(result.wrongState.length, 1);
assert.equal(result.priorDecision.length, 1);
assert.equal(sql(definitions), before, "rollback must preserve the installed evaluator");
console.log(JSON.stringify({ status: "PASS", migration: path, work, checks: ["matching state", "wrong state blocked", "missing prior decision blocked", "rollback preserved baseline functions"] }, null, 2));
