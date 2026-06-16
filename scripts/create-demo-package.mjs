import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const root = process.cwd();
const outputRoot = resolve(root, "package-output");
const bundleRoot = resolve(outputRoot, "rybexos-demo-package");

const includeEntries = [
  "app",
  "components",
  "docs",
  "lib",
  "public",
  "scripts",
  "supabase",
  ".env.example",
  "README.md",
  "next.config.ts",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "eslint.config.mjs"
];

const excludedNames = new Set([
  "node_modules",
  ".next",
  ".env",
  ".env.local",
  ".env.development",
  ".env.production",
  "package-output",
  "dist-demo",
  ".git"
]);

function shouldCopy(source) {
  return !excludedNames.has(basename(source));
}

rmSync(bundleRoot, { recursive: true, force: true });
mkdirSync(bundleRoot, { recursive: true });

for (const entry of includeEntries) {
  const source = resolve(root, entry);
  const destination = join(bundleRoot, entry);

  if (!existsSync(source)) {
    continue;
  }

  cpSync(source, destination, {
    recursive: true,
    filter: shouldCopy
  });
}

writeFileSync(
  join(bundleRoot, "PACKAGE-NOTES.md"),
  [
    "# RybexOS Demo Package",
    "",
    "This package is seed-backed by default. Do not add real secrets to the package.",
    "",
    "Run:",
    "",
    "```powershell",
    "npm install",
    "npm run demo:check",
    "npm run build",
    "npm run dev",
    "```",
    "",
    "Then open `http://127.0.0.1:3000/command-center`.",
    ""
  ].join("\n")
);

console.log(`Demo package folder created at ${bundleRoot}`);
