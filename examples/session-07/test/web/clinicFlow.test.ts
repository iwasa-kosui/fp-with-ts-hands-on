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
const appointmentUrl = `/appointments/${clinicFixture.appointmentId}`;

describe("Session 07 Web application", () => {
  let app: App;

  beforeEach(() => {
    app = createApp();
  });

  it("原子的なイベント保存use caseから会計済みまで進む", async () => {
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
      props: {
        sessionLabel: "Session 07",
        appointment: { kind: "Paid" },
      },
    });
  });

  it("予期可能な状態エラーを固定noticeへ変換する", async () => {
    const response = await post(app, `${appointmentUrl}/start-examination`);

    expect(response.headers.get("location")).toBe("/?notice=invalid-state");
  });

  it("原子的な保存の失敗時には状態もイベントも残さない", async () => {
    app = createApp({ failStore: true });
    await post(app, `${appointmentUrl}/check-in`);

    const response = await post(app, `${appointmentUrl}/start-examination`);

    expect(response.status).toBe(500);
    expect(await response.text()).toBe("Internal Server Error");
    expect(await page(app)).toMatchObject({
      props: { appointment: { kind: "CheckedIn" } },
    });
  });

  it("未実装操作とresetを共通URLで扱う", async () => {
    expect((await post(app, "/follow-ups/request")).headers.get("location"))
      .toBe("/?notice=not-implemented");
    await post(app, `${appointmentUrl}/check-in`);
    await post(app, "/demo/reset");
    expect(await page(app)).toMatchObject({
      props: { appointment: { kind: "Scheduled" } },
    });
  });
});
