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
  app.request(path, {
    method: "POST",
    headers: inertiaHeaders,
  });

const page = async (app: App) => {
  const response = await app.request("/", { headers: inertiaHeaders });
  expect(response.status).toBe(200);
  return response.json();
};

describe("Session 00 Web application", () => {
  let app: App;

  beforeEach(() => {
    app = createApp();
  });

  it("Hono routeから会計済みを診察中へ戻す事故を再現する", async () => {
    const appointmentUrl = `/appointments/${clinicFixture.appointmentId}`;

    expect((await post(app, `${appointmentUrl}/check-in`)).status).toBe(303);
    expect((await post(app, `${appointmentUrl}/start-examination`)).status).toBe(303);
    expect((await post(app, `${appointmentUrl}/exam-results`)).status).toBe(303);
    expect((await post(app, `${appointmentUrl}/payment`)).status).toBe(303);
    expect((await page(app))).toMatchObject({
      component: "ClinicDashboard",
      props: { appointment: { kind: "Paid" } },
    });

    expect((await post(app, `${appointmentUrl}/start-examination`)).status).toBe(303);
    expect((await page(app))).toMatchObject({
      component: "ClinicDashboard",
      props: { appointment: { kind: "InExamination" } },
    });
  });

  it("電話フォロー依頼を固定noticeへリダイレクトする", async () => {
    const response = await post(app, "/follow-ups/request");

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "/?notice=not-implemented",
    );
  });

  it("reset後は同じfixtureの予約済み状態へ戻る", async () => {
    const appointmentUrl = `/appointments/${clinicFixture.appointmentId}`;
    await post(app, `${appointmentUrl}/check-in`);

    const response = await post(app, "/demo/reset");

    expect(response.status).toBe(303);
    expect(await page(app)).toMatchObject({
      props: {
        appointment: {
          appointmentId: clinicFixture.appointmentId,
          kind: "Scheduled",
        },
      },
    });
  });

  it("未知の障害を内部情報のない500へ変換する", async () => {
    const secretId = "secret-appointment-id";

    const response = await post(
      app,
      `/appointments/${secretId}/start-examination`,
    );

    expect(response.status).toBe(500);
    expect(await response.text()).toBe("Internal Server Error");
  });
});
