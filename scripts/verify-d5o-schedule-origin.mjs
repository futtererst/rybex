import assert from "node:assert/strict";
import { validLocalScheduleOrigin } from "../lib/d5o/scheduling/request-origin.ts";

const headers = (origin, host, site = "same-origin") => new Headers({
  ...(origin ? { origin } : {}),
  ...(host ? { host } : {}),
  ...(site ? { "sec-fetch-site": site } : {})
});

for (const port of [61430, 61431]) {
  assert.equal(validLocalScheduleOrigin(headers(`http://127.0.0.1:${port}`, `127.0.0.1:${port}`)), true);
}
for (const invalid of [
  headers("http://127.0.0.1:61431", "127.0.0.1:61430"),
  headers("http://127.0.0.1:61431", "localhost:61431"),
  headers("http://127.0.0.1:61432", "127.0.0.1:61432"),
  headers("http://example.com", "example.com"),
  headers("http://127.0.0.1:61431", "127.0.0.1:61431", "cross-site"),
  headers("http://127.0.0.1:61431", "127.0.0.1:61431", ""),
  headers(null, "127.0.0.1:61431"),
  headers("http://127.0.0.1:61431", null)
]) assert.equal(validLocalScheduleOrigin(invalid), false);

console.log("PASS: local schedule mutations accept the browser-visible host and reject missing, mismatched, or cross-site origins");
