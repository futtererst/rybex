import { verifiedHistoricalReference } from "./m1/qualification/historical-reference.mjs";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  check,
  createdTableNames,
  finish,
  migrationsDir,
  readAllConfigurationSql,
  readWorkspaceFile,
  root,
} from "./configuration-foundation-static-utils.mjs";

const results = [];

for (const fileName of [
  "0011_p1_01a_opportunity_intake_qualification.sql",
  "0012_p1_01a_acceptance_remediation.sql",
  "0013_p1_01a_role_accountability_read_model.sql",
  "0014_p1_01a_decision_owner_actions.sql",
  "0015_p1_01b_1_pursuit_authorization.sql",
  "0016_p1_01b_2_bid_submission_outcome.sql",
]) {
  check(results, `${fileName} still exists`, existsSync(join(migrationsDir, fileName)));
}

check(results, "P1-01B.1 accepted baseline exists", (process.env.M1_QUALIFICATION_MANIFEST ? verifiedHistoricalReference("artifacts/p1-01b-1-human-acceptance-baseline/ACCEPTANCE-MANIFEST.json") : existsSync(join(root, "artifacts", "p1-01b-1-human-acceptance-baseline", "ACCEPTANCE-MANIFEST.json"))));
check(results, "P1-01B.2 accepted baseline exists", (process.env.M1_QUALIFICATION_MANIFEST ? verifiedHistoricalReference("artifacts/p1-01b-2-human-acceptance-baseline/ACCEPTANCE-MANIFEST.json") : existsSync(join(root, "artifacts", "p1-01b-2-human-acceptance-baseline", "ACCEPTANCE-MANIFEST.json"))));

const configurationSql = readAllConfigurationSql();
const createdTables = createdTableNames(configurationSql);
const forbiddenCreated = createdTables.filter((table) =>
  /p1_01b_3|award_validation|project_readiness|mobilization|configuration_studio|runtime_template_pack_loading/.test(table),
);
check(results, "new migrations do not create P1-01B.3/project readiness/mobilization/Studio tables", forbiddenCreated.length === 0, forbiddenCreated.join(", "));

const recommendedNext = readWorkspaceFile("docs/recommended-next-implementation.md").toLowerCase();
check(results, "recommended-next keeps P1-01B.3 paused or unauthorized", recommendedNext.includes("p1-01b.3") && (recommendedNext.includes("paused") || recommendedNext.includes("unauthorized")));
check(results, "recommended-next keeps demo readiness No-Go", recommendedNext.includes("demo readiness") && recommendedNext.includes("no-go"));
check(results, "recommended-next keeps production readiness No-Go", recommendedNext.includes("production readiness") && recommendedNext.includes("no-go"));

finish(results, "Configuration Foundation no-regression static verification");
