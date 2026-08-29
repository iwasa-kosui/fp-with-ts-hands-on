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

describe("Session 06 Web application", () => {
  let app: App;

  beforeEach(() => {
    app = createApp();
  });

  it("非決定値と2回保存を含むuse caseを画面操作から実行する", async () => {
    await post(app, `${appointmentUrl}/check-in`);
    expect((await post(app, `${appointmentUrl}/start-examination`)).status).toBe(303);
    expect(await page(app)).toMatchObject({
      props: {
        sessionLabel: "Session 06",
        appointment: { kind: "InExamination" },
      },
    });
  });

  it("予期可能な状態エラーを固定noticeへ変換する", async () => {
    const response = await post(app, `${appointmentUrl}/start-examination`);

    expect(response.headers.get("location")).toBe("/?notice=invalid-state");
  });

  it("予約なしを専用noticeへ変換する", async () => {
    const response = await post(
      app,
      "/appointments/99999999-9999-4999-8999-999999999999/start-examination",
    );

    expect(response.headers.get("location")).toBe("/?notice=not-found");
  });

  it("2回目の保存失敗で状態だけ残る事故を再現する", async () => {
    app = createApp({ failEventLog: true });
    await post(app, `${appointmentUrl}/check-in`);

    const response = await post(app, `${appointmentUrl}/start-examination`);

    expect(response.status).toBe(500);
    expect(await page(app)).toMatchObject({
      props: { appointment: { kind: "InExamination" } },
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
