import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(process.cwd());
const migrationRoot = join(root, "supabase", "migrations");
const migration0029 = "0029_cfg_runtime_03_bid_submission_approval.sql";
const expected0029 = "fc2dd4616f19cfdc97cb7ba0d234236f30797f3c3ca82fa4d976b848820ca15a";
const migration0030 = "0030_cfg_runtime_03_evidence_persistence_authority.sql";
const expected0030 = "3a597bd63309d7a6139a86fde66ea998b18e56b1ba9b36a4ea8714cfffe50cda";
const only = process.argv.find((value) => value.startsWith("--only="))?.slice(7) ?? "all";
if (!["all", "0029", "0030"].includes(only)) throw new Error(`unsupported --only value: ${only}`);
const migrations = readdirSync(migrationRoot).filter((name) => /^\d{4}_.*\.sql$/.test(name)).sort();
const hash = (name) => createHash("sha256").update(readFileSync(join(migrationRoot, name))).digest("hex");
if (only !== "0030" && hash(migration0029) !== expected0029) throw new Error(`migration 0029 changed: ${hash(migration0029)}`);
if (only !== "0029" && hash(migration0030) !== expected0030) throw new Error(`migration 0030 changed: ${hash(migration0030)}`);
const after0029 = migrations.filter((name) => Number(name.slice(0, 4)) > 29);
const expectedAfter0029 = [
  migration0030,
  "0031_cfg_runtime_03_actor_profile_identity_coherence.sql",
];
if (JSON.stringify(after0029) !== JSON.stringify(expectedAfter0029)) {
  throw new Error(`expected exactly migrations 0030 and 0031 after 0029, saw ${after0029.join(", ")}`);
}
if (only !== "0030") console.log(`PASS: migration 0029 is byte-identical (${expected0029}).`);
if (only !== "0029") console.log(`PASS: migration 0030 is byte-identical (${expected0030}).`);
console.log(`PASS: exactly one new forward-only migration follows 0030: ${after0029[1]} (${hash(after0029[1])}).`);
