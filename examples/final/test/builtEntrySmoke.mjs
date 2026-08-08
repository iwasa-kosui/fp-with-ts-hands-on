import { strict as assert } from "node:assert";
import { access, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

await Promise.all([
  access(new URL("../dist/app.js", import.meta.url)),
  access(new URL("../dist/index.js", import.meta.url)),
  access(new URL("../dist/static/client.js", import.meta.url)),
  access(new URL("../dist/static/styles.css", import.meta.url)),
]);

const executableSource = await readFile(
  new URL("../dist/index.js", import.meta.url),
  "utf8",
);
assert.match(
  executableSource,
  /}\nserve\(\{ fetch: mainApp\.fetch, port: 3e3 }\);\nexport/,
);
assert.doesNotMatch(executableSource, /NODE_ENV.{0,20}test|test.{0,20}NODE_ENV|test-mode/);
assert.doesNotMatch(executableSource, /mainApp\.use\("\/app\.js"/);

const { createDatabaseBackedApp } = await import("../dist/app.js");
const app = createDatabaseBackedApp({
  databasePath: ":memory:",
  migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)),
});
const response = await app.request("/", {
  headers: {
    Accept: "application/json",
    "X-Inertia": "true",
    "X-Inertia-Version": "1",
  },
});

assert.equal(response.status, 302);
assert.equal(response.headers.get("location"), "/setup");
