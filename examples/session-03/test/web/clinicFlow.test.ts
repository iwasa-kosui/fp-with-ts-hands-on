import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { clinicFixture } from "../../../fixtures/clinic.js";
import { createDatabaseBackedApp } from "../../src/app.js";

const inertiaHeaders = {
  Accept: "application/json",
  "X-Inertia": "true",
  "X-Inertia-Version": "1",
} as const;

type App = ReturnType<typeof createDatabaseBackedApp>;

const post = (app: App, path: string, body?: unknown) =>
  body === undefined
    ? app.request(path, { method: "POST", headers: inertiaHeaders })
    : app.request(path, {
        method: "POST",
        headers: { ...inertiaHeaders, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

const page = async (app: App) => {
  const response = await app.request("/", { headers: inertiaHeaders });
  expect(response.status).toBe(200);
  return response.json();
};

describe("Session 03 Web application", () => {
  let app: App;
  let directory: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "clinic-session-03-web-"));
    app = createDatabaseBackedApp({
      databasePath: join(directory, "clinic.sqlite"),
      migrationsFolder: fileURLToPath(new URL("../../drizzle", import.meta.url)),
      isProduction: false,
    });
  });

  afterEach(() => {
    app.close();
    rmSync(directory, { recursive: true, force: true });
  });

  it("型で絞った遷移をHono routeから最後まで呼び出す", async () => {
    const appointmentUrl = `/appointments/${clinicFixture.appointmentId}`;

    expect(await page(app)).toMatchObject({
      props: { sessionLabel: "Session 03", appointment: { kind: "Scheduled" } },
    });
    await post(app, `${appointmentUrl}/check-in`);
    await post(app, `${appointmentUrl}/start-examination`);
    await post(app, `${appointmentUrl}/exam-results`, {
      examId: clinicFixture.examId,
      petId: clinicFixture.petId,
      items: ["skin"],
      needsFollowUp: false,
    });
    await post(app, `${appointmentUrl}/payment`);

    expect(await page(app)).toMatchObject({
      props: { appointment: { kind: "Paid" } },
    });
  });

  it("診察結果を記録する前の会計を拒否する", async () => {
    const response = await post(
      app,
      `/appointments/${clinicFixture.appointmentId}/payment`,
    );

    expect(response.status).toBe(500);
  });

  it("未実装操作とresetを共通URLで扱う", async () => {
    const appointmentUrl = `/appointments/${clinicFixture.appointmentId}`;
    const unimplemented = await post(app, "/follow-ups/request");
    expect(unimplemented.headers.get("location")).toBe(
      "/?notice=not-implemented",
    );

    await post(app, `${appointmentUrl}/check-in`);
    await post(app, "/demo/reset");
    expect(await page(app)).toMatchObject({
      props: { appointment: { kind: "Scheduled" } },
    });
  });
});
