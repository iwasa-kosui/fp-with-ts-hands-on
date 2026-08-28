import { readFile } from "node:fs/promises";

import { beforeEach, describe, expect, it } from "vitest";

import { clinicFixture } from "../../../fixtures/clinic.js";
import { createApp } from "../../src/app.js";

const inertiaHeaders = {
  Accept: "application/json",
  "X-Inertia": "true",
  "X-Inertia-Version": "1",
} as const;

type App = ReturnType<typeof createApp>;

const post = (app: App, path: string) =>
  app.request(path, { method: "POST", headers: inertiaHeaders });

const page = async (app: App) => {
  const response = await app.request("/", { headers: inertiaHeaders });
  expect(response.status).toBe(200);
  return response.json();
};

describe("Session 01 Web application", () => {
  let app: App;

  beforeEach(() => {
    app = createApp();
  });

  it("独立したHono appとしてlegacy workflowを表示する", async () => {
    expect(await page(app)).toMatchObject({
      component: "ClinicDashboard",
      props: {
        sessionLabel: "Session 01",
        appointment: {
          appointmentId: clinicFixture.appointmentId,
          kind: "Scheduled",
        },
      },
    });
  });

  it("業務イベント分析前の不正な戻り遷移を再現できる", async () => {
    const appointmentUrl = `/appointments/${clinicFixture.appointmentId}`;
    await post(app, `${appointmentUrl}/payment`);
    await post(app, `${appointmentUrl}/start-examination`);

    expect(await page(app)).toMatchObject({
      props: { appointment: { kind: "InExamination" } },
    });
  });

  it("Session 00の実装をimportしない", async () => {
    const source = await readFile(
      new URL("../../src/web/routes.ts", import.meta.url),
      "utf8",
    );

    expect(source).not.toContain("session-00");
  });
});
