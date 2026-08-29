import { beforeEach, describe, expect, it } from "vitest";

import { clinicFixture } from "../../../fixtures/clinic.js";
import { createApp } from "../../src/app.js";

const inertiaHeaders = {
  Accept: "application/json",
  "X-Inertia": "true",
  "X-Inertia-Version": "1",
} as const;

type App = ReturnType<typeof createApp>;

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

describe("Session 02 Web application", () => {
  let app: App;

  beforeEach(() => {
    app = createApp();
  });

  it("その時点の遷移関数で予約済みから会計済みまで操作できる", async () => {
    const appointmentUrl = `/appointments/${clinicFixture.appointmentId}`;

    expect(await page(app)).toMatchObject({
      component: "ClinicDashboard",
      props: {
        sessionLabel: "Session 02",
        appointment: { kind: "Scheduled" },
        actions: {
          checkIn: { kind: "Available" },
          recordPayment: { kind: "Hidden" },
          requestFollowUp: { kind: "NotImplemented" },
        },
      },
    });
    await post(app, `${appointmentUrl}/check-in`);
    await post(app, `${appointmentUrl}/start-examination`);
    await post(app, `${appointmentUrl}/exam-results`, {
      examId: clinicFixture.examId,
      petId: clinicFixture.petId,
      items: ["skin"],
      needsFollowUp: false,
    });
    expect((await page(app))).toMatchObject({
      props: { appointment: { kind: "AwaitingPayment" } },
    });
    await post(app, `${appointmentUrl}/payment`);

    expect((await page(app))).toMatchObject({
      props: { appointment: { kind: "Paid" } },
    });
  });

  it("診察結果を記録する前の会計を拒否する", async () => {
    const response = await post(
      app,
      `/appointments/${clinicFixture.appointmentId}/payment`,
    );

    expect(response.status).toBe(500);
    expect(await response.text()).toBe("Internal Server Error");
  });

  it("未実装操作を固定noticeへ戻し、resetで同じfixtureへ戻す", async () => {
    const appointmentUrl = `/appointments/${clinicFixture.appointmentId}`;
    const unimplemented = await post(app, "/follow-ups/request");
    expect(unimplemented.status).toBe(303);
    expect(unimplemented.headers.get("location")).toBe(
      "/?notice=not-implemented",
    );

    await post(app, `${appointmentUrl}/check-in`);
    expect((await post(app, "/demo/reset")).status).toBe(303);
    expect(await page(app)).toMatchObject({
      props: {
        appointment: {
          appointmentId: clinicFixture.appointmentId,
          kind: "Scheduled",
        },
      },
    });
  });
});
