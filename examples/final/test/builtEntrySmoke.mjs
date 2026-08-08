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
  isProduction: true,
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

const setupPage = await app.request("/setup", {
  headers: { Accept: "text/html" },
});
const setupHtml = await setupPage.text();
assert.equal(setupPage.status, 200);
assert.match(setupHtml, /\/static\/client\.js/);
assert.match(setupHtml, /\/static\/styles\.css/);
assert.doesNotMatch(setupHtml, /\/src\/adaptor\/primary\/web\/client\.tsx/);

const setupResponse = await app.request("/setup", {
  method: "POST",
  body: new URLSearchParams({
    email: "built-admin@example.test",
    name: "Built Admin",
    password: "correct horse battery staple",
  }),
  headers: {
    Accept: "application/json",
    "Content-Type": "application/x-www-form-urlencoded",
    Origin: "http://localhost",
    "X-Inertia": "true",
    "X-Inertia-Version": "1",
  },
});
assert.equal(setupResponse.status, 302);
assert.match(setupResponse.headers.get("set-cookie") ?? "", /; Secure(?:;|$)/);

const loginResponse = await app.request("/login", {
  method: "POST",
  body: new URLSearchParams({
    email: "built-admin@example.test",
    password: "correct horse battery staple",
  }),
  headers: {
    Accept: "application/json",
    "Content-Type": "application/x-www-form-urlencoded",
    Origin: "http://localhost",
    "X-Inertia": "true",
    "X-Inertia-Version": "1",
  },
});
assert.equal(loginResponse.status, 302);
assert.match(loginResponse.headers.get("set-cookie") ?? "", /; Secure(?:;|$)/);
