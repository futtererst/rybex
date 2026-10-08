import { existsSync } from "node:fs";
import {
  check,
  expectedConfigurationMigrations,
  finish,
  listConfigurationMigrations,
  migrationPath,
} from "./configuration-foundation-static-utils.mjs";

const results = [];
const actual = listConfigurationMigrations();

check(results, "expected configuration migration count", actual.length === expectedConfigurationMigrations.length, `${actual.length} found`);
check(results, "configuration migration names match authority", JSON.stringify(actual) === JSON.stringify(expectedConfigurationMigrations), actual.join(", "));

for (const fileName of expectedConfigurationMigrations) {
  check(results, `${fileName} exists`, existsSync(migrationPath(fileName)));
}

const unauthorized = actual.filter((fileName) => !expectedConfigurationMigrations.includes(fileName));
check(results, "no unauthorized 0017+ configuration migrations", unauthorized.length === 0, unauthorized.join(", "));

const expectedPrefixes = expectedConfigurationMigrations.map((fileName) => fileName.slice(0, 4));
check(results, "expected numeric order is contiguous 0017 through 0026", expectedPrefixes.join(",") === "0017,0018,0019,0020,0021,0022,0023,0024,0025,0026");

finish(results, "Configuration Foundation migration order verification");
