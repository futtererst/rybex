import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export const root = process.env.CONFIGURATION_FOUNDATION_VERIFY_ROOT || process.cwd();
export const migrationsDir = join(root, "supabase", "migrations");

export const expectedConfigurationMigrations = [
  "0017_configuration_foundation_core.sql",
  "0018_configuration_template_packs_versions.sql",
  "0019_configuration_tenant_activation_versions.sql",
  "0020_configuration_phase_gate_definitions.sql",
  "0021_configuration_work_types_streams_lanes.sql",
  "0022_configuration_roles_permissions_decision_rights.sql",
  "0023_configuration_artifact_evidence_definitions.sql",
  "0024_configuration_kpi_financial_workforce_handoff_governance.sql",
  "0025_configuration_audit_effective_resolution.sql",
  "0026_configuration_template_pack_seed_data.sql",
];

export function readWorkspaceFile(relativePath) {
  return readFileSync(join(root, relativePath), "utf8");
}

export function migrationPath(fileName) {
  return join(migrationsDir, fileName);
}

export function readMigration(fileName) {
  return readFileSync(migrationPath(fileName), "utf8");
}

export function listConfigurationMigrations() {
  if (!existsSync(migrationsDir)) {
    return [];
  }

  return readdirSync(migrationsDir)
    .filter((name) => /^00(1[7-9]|2[0-9])_configuration_.*\.sql$/.test(name))
    .sort();
}

export function readAllConfigurationSql() {
  return expectedConfigurationMigrations
    .filter((fileName) => existsSync(migrationPath(fileName)))
    .map((fileName) => `-- ${fileName}\n${readMigration(fileName)}`)
    .join("\n\n");
}

export function check(results, name, passed, detail = "") {
  results.push({ name, passed: Boolean(passed), detail });
}

export function finish(results, title) {
  const failures = results.filter((result) => !result.passed);

  for (const result of results) {
    const prefix = result.passed ? "PASS" : "FAIL";
    console.log(`${prefix}: ${result.name}${result.detail ? ` - ${result.detail}` : ""}`);
  }

  if (failures.length > 0) {
    console.error(`\n${title} failed with ${failures.length} issue(s).`);
    process.exit(1);
  }

  console.log(`\n${title} passed.`);
}

export function normalizeSql(sql) {
  return sql.toLowerCase().replace(/\s+/g, " ");
}

export function stripSqlComments(sql) {
  return sql
    .replace(/--.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
}

export function createdTableNames(sql) {
  const names = [];
  const regex = /create\s+table\s+if\s+not\s+exists\s+([a-z0-9_]+)/gi;
  let match = regex.exec(sql);
  while (match) {
    names.push(match[1].toLowerCase());
    match = regex.exec(sql);
  }
  return names;
}

export function extractCreateTablesByFile() {
  const tables = new Map();

  for (const fileName of expectedConfigurationMigrations) {
    if (!existsSync(migrationPath(fileName))) {
      continue;
    }

    const sql = stripSqlComments(readMigration(fileName));
    const regex = /create\s+table\s+if\s+not\s+exists\s+([a-z0-9_]+)\s*\(([\s\S]*?)\n\);/gi;
    let match = regex.exec(sql);
    while (match) {
      const tableName = match[1].toLowerCase();
      const body = match[2];
      const columns = new Set();

      for (const rawLine of body.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || /^constraint\s+/i.test(line) || /^foreign\s+key\s+/i.test(line) || /^unique\s*\(/i.test(line) || /^check\s*\(/i.test(line)) {
          continue;
        }

        const columnMatch = /^([a-z0-9_]+)\s+/i.exec(line);
        if (columnMatch) {
          columns.add(columnMatch[1].toLowerCase());
        }
      }

      tables.set(tableName, { fileName, columns, body });
      match = regex.exec(sql);
    }
  }

  return tables;
}

export function extractIndexesByFile() {
  const indexes = [];

  for (const fileName of expectedConfigurationMigrations) {
    if (!existsSync(migrationPath(fileName))) {
      continue;
    }

    const sql = stripSqlComments(readMigration(fileName));
    const regex = /create\s+(unique\s+)?index\s+if\s+not\s+exists\s+([a-z0-9_]+)\s+on\s+([a-z0-9_]+)\s*\(([^;]+?)\)(?:\s+where\s+([^;]+?))?;/gi;
    let match = regex.exec(sql);
    while (match) {
      const columns = match[4]
        .split(",")
        .map((part) => part.trim().toLowerCase().split(/\s+/)[0])
        .filter((part) => /^[a-z_][a-z0-9_]*$/.test(part));

      indexes.push({
        fileName,
        unique: Boolean(match[1]),
        indexName: match[2].toLowerCase(),
        tableName: match[3].toLowerCase(),
        columns,
        predicateColumns: extractSqlIdentifiers(match[5] || ""),
      });
      match = regex.exec(sql);
    }
  }

  return indexes;
}

export function extractSqlIdentifiers(expression) {
  const expressionWithoutStrings = expression.replace(/'[^']*'/g, " ");
  const ignored = new Set([
    "and",
    "or",
    "not",
    "null",
    "is",
    "in",
    "where",
    "true",
    "false",
    "like",
    "ilike",
    "as",
    "on",
  ]);
  const identifiers = new Set();
  const regex = /\b([a-z_][a-z0-9_]*)\b/gi;
  let match = regex.exec(expressionWithoutStrings);
  while (match) {
    const value = match[1].toLowerCase();
    if (!ignored.has(value) && !/^[0-9]+$/.test(value)) {
      identifiers.add(value);
    }
    match = regex.exec(expressionWithoutStrings);
  }
  return [...identifiers];
}

export function extractForeignKeysByFile() {
  const foreignKeys = [];

  for (const fileName of expectedConfigurationMigrations) {
    if (!existsSync(migrationPath(fileName))) {
      continue;
    }

    const sql = stripSqlComments(readMigration(fileName));
    const createTableRegex = /create\s+table\s+if\s+not\s+exists\s+([a-z0-9_]+)\s*\(([\s\S]*?)\n\);/gi;
    let tableMatch = createTableRegex.exec(sql);
    while (tableMatch) {
      const tableName = tableMatch[1].toLowerCase();
      const body = tableMatch[2];

      const inlineRegex = /^\s*([a-z0-9_]+)\s+[^,\n]*?\breferences\s+([a-z0-9_.]+)\s*\(([^)]+)\)/gim;
      let inlineMatch = inlineRegex.exec(body);
      while (inlineMatch) {
        foreignKeys.push({
          fileName,
          constraintName: `${tableName}_${inlineMatch[1].toLowerCase()}_inline_fkey`,
          tableName,
          columns: [inlineMatch[1].toLowerCase()],
          referencedTableName: inlineMatch[2].split(".").pop().toLowerCase(),
          referencedColumns: inlineMatch[3].split(",").map((column) => column.trim().toLowerCase()),
        });
        inlineMatch = inlineRegex.exec(body);
      }

      const tableConstraintRegex = /constraint\s+([a-z0-9_]+)\s+foreign\s+key\s*\(([^)]+)\)\s+references\s+([a-z0-9_.]+)\s*\(([^)]+)\)/gi;
      let tableConstraintMatch = tableConstraintRegex.exec(body);
      while (tableConstraintMatch) {
        foreignKeys.push({
          fileName,
          constraintName: tableConstraintMatch[1].toLowerCase(),
          tableName,
          columns: tableConstraintMatch[2].split(",").map((column) => column.trim().toLowerCase()),
          referencedTableName: tableConstraintMatch[3].split(".").pop().toLowerCase(),
          referencedColumns: tableConstraintMatch[4].split(",").map((column) => column.trim().toLowerCase()),
        });
        tableConstraintMatch = tableConstraintRegex.exec(body);
      }

      tableMatch = createTableRegex.exec(sql);
    }

    const alterRegex = /alter\s+table\s+([a-z0-9_]+)\s+[\s\S]*?add\s+constraint\s+([a-z0-9_]+)\s+foreign\s+key\s*\(([^)]+)\)\s+references\s+([a-z0-9_.]+)\s*\(([^)]+)\)/gi;
    let alterMatch = alterRegex.exec(sql);
    while (alterMatch) {
      foreignKeys.push({
        fileName,
        constraintName: alterMatch[2].toLowerCase(),
        tableName: alterMatch[1].toLowerCase(),
        columns: alterMatch[3].split(",").map((column) => column.trim().toLowerCase()),
        referencedTableName: alterMatch[4].split(".").pop().toLowerCase(),
        referencedColumns: alterMatch[5].split(",").map((column) => column.trim().toLowerCase()),
      });
      alterMatch = alterRegex.exec(sql);
    }
  }

  return foreignKeys;
}

export function extractFunctionsByFile() {
  const functions = new Set();

  for (const fileName of expectedConfigurationMigrations) {
    if (!existsSync(migrationPath(fileName))) {
      continue;
    }

    const sql = stripSqlComments(readMigration(fileName));
    const regex = /create\s+or\s+replace\s+function\s+(?:public\.)?([a-z0-9_]+)\s*\(/gi;
    let match = regex.exec(sql);
    while (match) {
      functions.add(match[1].toLowerCase());
      match = regex.exec(sql);
    }
  }

  return functions;
}

export function extractTriggersByFile() {
  const triggers = [];

  for (const fileName of expectedConfigurationMigrations) {
    if (!existsSync(migrationPath(fileName))) {
      continue;
    }

    const sql = stripSqlComments(readMigration(fileName));
    const regex = /create\s+trigger\s+([a-z0-9_]+)[\s\S]*?\s+on\s+([a-z0-9_]+)[\s\S]*?execute\s+function\s+(?:public\.)?([a-z0-9_]+)\s*\(/gi;
    let match = regex.exec(sql);
    while (match) {
      triggers.push({
        fileName,
        triggerName: match[1].toLowerCase(),
        tableName: match[2].toLowerCase(),
        functionName: match[3].toLowerCase(),
      });
      match = regex.exec(sql);
    }
  }

  return triggers;
}
