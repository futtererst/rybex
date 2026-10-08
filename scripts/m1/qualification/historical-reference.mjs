import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { isAbsolute, resolve, relative } from "node:path";

const expected = Object.freeze({
  "artifacts/p1-01b-1-human-acceptance-baseline/ACCEPTANCE-MANIFEST.json": "4a9bed1bf140e19e461a222a20dda615da5f0e7dd149493aa40b218ca6f13eee",
  "artifacts/p1-01b-2-human-acceptance-baseline/ACCEPTANCE-MANIFEST.json": "218e404b47ac4e6d210a02c83c65852de4449e0718aee1d74b92bd1193a25d56",
});

// Historical integrity only: never grants current acceptance or implementation authority.
export function verifiedHistoricalReference(path, manifestPath = process.env.M1_QUALIFICATION_MANIFEST) {
  if (!manifestPath || !isAbsolute(manifestPath)) throw new Error("Explicit absolute qualification manifest required");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (manifest.version !== 1 || manifest.historicalOnly !== true || !isAbsolute(manifest.referenceRoot ?? "")) throw new Error("Invalid historical reference manifest");
  if (!Object.hasOwn(expected, path) || manifest.references?.[path] !== expected[path]) throw new Error("Unapproved historical reference");
  const target = resolve(manifest.referenceRoot, path);
  const rel = relative(manifest.referenceRoot, target);
  if (rel.startsWith("..") || isAbsolute(rel)) throw new Error("Historical reference escapes root");
  if (createHash("sha256").update(readFileSync(target)).digest("hex") !== expected[path]) throw new Error("Historical reference hash mismatch");
  return true;
}
