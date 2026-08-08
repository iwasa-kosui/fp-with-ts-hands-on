import { access } from "node:fs/promises";
import { strict as assert } from "node:assert";

process.env.NODE_ENV = "test";

await Promise.all([
  access(new URL("../dist/index.js", import.meta.url)),
  access(new URL("../dist/static/client.js", import.meta.url)),
  access(new URL("../dist/static/styles.css", import.meta.url)),
]);

const { default: app } = await import("../dist/index.js");
const response = await app.request("/", {
  headers: {
    Accept: "application/json",
    "X-Inertia": "true",
    "X-Inertia-Version": "1",
  },
});

assert.equal(response.status, 302);
assert.equal(response.headers.get("location"), "/setup");
