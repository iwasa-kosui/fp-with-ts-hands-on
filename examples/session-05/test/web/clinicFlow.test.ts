import { beforeEach, describe, expect, it } from "vitest";

import { clinicFixture } from "../../../fixtures/clinic.js";
import { createApp } from "../../src/app.js";

const inertiaHeaders = {
  Accept: "application/json",
  "X-Inertia": "true",
  "X-Inertia-Version": "1",
} as const;
type App = ReturnType<typeof createApp>;
const post = (app: App, path: string, body?: unknown) => body === undefined
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
const examPayload = {
  examId: clinicFixture.examId,
  petId: clinicFixture.petId,
  items: ["skin"],
  needsFollowUp: false,
} as const;

describe("Session 05 Web application", () => {
  let app: App;
  const appointmentUrl = `/appointments/${clinicFixture.appointmentId}`;

  beforeEach(() => {
    app = createApp();
  });

  it("例外ベースの診察開始use caseを通って会計済みまで進む", async () => {
    expect(await page(app)).toMatchObject({
      props: { sessionLabel: "Session 05", appointment: { kind: "Scheduled" } },
    });
    await post(app, `${appointmentUrl}/check-in`);
    await post(app, `${appointmentUrl}/start-examination`);
    await post(app, `${appointmentUrl}/exam-results`, examPayload);
    await post(app, `${appointmentUrl}/payment`);

    expect(await page(app)).toMatchObject({
      props: { appointment: { kind: "Paid" } },
    });
  });

  it("古い画面から送られた状態不正をcatchし損ねて500になる", async () => {
    const invalidState = await post(app, `${appointmentUrl}/start-examination`);

    expect(invalidState.status).toBe(500);
    expect(await invalidState.text()).toBe("Internal Server Error");
  });

  it("starterが例外メッセージで予約なしだけをnoticeへ変換する", async () => {
    const missing = await post(
      app,
      "/appointments/99999999-9999-4999-8999-999999999999/start-examination",
    );

    expect(missing.headers.get("location")).toBe("/?notice=not-found");
  });

  it("不正な検査入力を拒否し、未実装操作とresetを扱う", async () => {
    await post(app, `${appointmentUrl}/check-in`);
    await post(app, `${appointmentUrl}/start-examination`);
    expect((await post(app, `${appointmentUrl}/exam-results`, {
      ...examPayload,
      examId: "not-a-uuid",
    })).status).toBe(500);
    expect((await post(app, "/follow-ups/request")).headers.get("location"))
      .toBe("/?notice=not-implemented");

    await post(app, "/demo/reset");
    expect(await page(app)).toMatchObject({
      props: { appointment: { kind: "Scheduled" } },
    });
  });
});
