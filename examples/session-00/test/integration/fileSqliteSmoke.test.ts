import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { afterEach, expect, test } from "vitest";

import { createDatabaseBackedApp } from "../../src/app.js";

const directories: string[] = [];

const inertiaHeaders = {
  Accept: "application/json",
  "X-Inertia": "true",
  "X-Inertia-Version": "1",
} as const;

const post = (app: ReturnType<typeof createDatabaseBackedApp>, path: string) =>
  app.request(path, { method: "POST", headers: inertiaHeaders });

const page = async (app: ReturnType<typeof createDatabaseBackedApp>) =>
  (await app.request("/", { headers: inertiaHeaders })).json();

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("ファイルSQLiteは再起動後も未知statusと監査を復元する", async () => {
  const directory = mkdtempSync(join(tmpdir(), "clinic-session-00-"));
  directories.push(directory);
  const options = {
    databasePath: join(directory, "clinic.sqlite"),
    migrationsFolder: fileURLToPath(new URL("../../drizzle", import.meta.url)),
    isProduction: false,
  } as const;

  const first = createDatabaseBackedApp(options);
  expect(existsSync(options.databasePath)).toBe(true);
  expect((await post(first, "/demo/incidents/unknown-status")).status).toBe(
    303,
  );

  const firstPage = await page(first);
  const firstAuditLogs = JSON.parse(
    firstPage.props.incidentLab.inspection.auditLogJson,
  );
  expect(firstPage).toMatchObject({
    props: { appointment: { kind: "waiting-for-magic" } },
  });

  const second = createDatabaseBackedApp(options);
  const secondPage = await page(second);
  expect(secondPage).toMatchObject({
    props: { appointment: { kind: "waiting-for-magic" } },
  });
  expect(
    JSON.parse(secondPage.props.incidentLab.inspection.auditLogJson),
  ).toEqual(firstAuditLogs);
});
