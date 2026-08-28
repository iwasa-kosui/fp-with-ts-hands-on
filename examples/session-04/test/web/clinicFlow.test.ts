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

describe("Session 04 Web application", () => {
  let app: App;

  beforeEach(() => {
    app = createApp();
  });

  it("用途別IDと入力境界を通って会計済みまで操作できる", async () => {
    const appointmentUrl = `/appointments/${clinicFixture.appointmentId}`;

    expect(await page(app)).toMatchObject({
      props: { sessionLabel: "Session 04", appointment: { kind: "Scheduled" } },
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

  it("starterの未検証境界が不正な検査JSONを受け入れる問題を再現する", async () => {
    const appointmentUrl = `/appointments/${clinicFixture.appointmentId}`;
    await post(app, `${appointmentUrl}/check-in`);
    await post(app, `${appointmentUrl}/start-examination`);

    const response = await post(app, `${appointmentUrl}/exam-results`, {
      examId: "not-a-uuid",
      petId: "wrong-pet",
      items: [""],
      needsFollowUp: "yes",
    });

    expect(response.status).toBe(303);
    expect(await page(app)).toMatchObject({
      props: { appointment: { kind: "AwaitingPayment" } },
    });
  });

  it("診察結果前の会計を拒否し、未実装操作とresetを扱う", async () => {
    const appointmentUrl = `/appointments/${clinicFixture.appointmentId}`;
    expect((await post(app, `${appointmentUrl}/payment`)).status).toBe(500);
    expect((await post(app, "/follow-ups/request")).headers.get("location"))
      .toBe("/?notice=not-implemented");

    await post(app, `${appointmentUrl}/check-in`);
    await post(app, "/demo/reset");
    expect(await page(app)).toMatchObject({
      props: { appointment: { kind: "Scheduled" } },
    });
  });
});
