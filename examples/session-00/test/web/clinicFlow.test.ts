import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clinicFixture } from "../../../fixtures/clinic.js";
import {
  createSqliteDatabase,
  migrateDatabase,
} from "../../src/adaptor/secondary/sqlite/db.js";
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

const createTestApp = (): App => {
  const database = createSqliteDatabase(":memory:");
  migrateDatabase(database);

  return createApp(database);
};

describe("Session 00 Web application", () => {
  let app: App;

  beforeEach(() => {
    app = createTestApp();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("未改善の通常操作が会計済みを診察中へ戻してしまう", async () => {
    const appointmentUrl = `/appointments/${clinicFixture.appointmentId}`;

    expect((await post(app, `${appointmentUrl}/check-in`)).status).toBe(303);
    expect(
      (await post(app, `${appointmentUrl}/start-examination`)).status,
    ).toBe(303);
    expect((await post(app, `${appointmentUrl}/exam-results`)).status).toBe(
      303,
    );
    expect((await post(app, `${appointmentUrl}/payment`)).status).toBe(303);
    expect(await page(app)).toMatchObject({
      component: "ClinicDashboard",
      props: { appointment: { kind: "Paid" } },
    });

    expect(
      (await post(app, `${appointmentUrl}/start-examination`)).status,
    ).toBe(303);
    expect(await page(app)).toMatchObject({
      component: "ClinicDashboard",
      props: {
        appointment: { kind: "InExamination" },
        actions: {
          checkIn: { kind: "Available" },
          startExamination: { kind: "Available" },
          recordExamResult: { kind: "Available" },
          recordPayment: { kind: "Available" },
          cancel: { kind: "Available" },
          requestFollowUp: { kind: "NotImplemented" },
        },
      },
    });
  });

  it("事故routeから未知のstatusを保存して警告する", async () => {
    expect((await post(app, "/demo/incidents/unknown-status")).status).toBe(
      303,
    );

    const inspection = (await page(app)).props.incidentLab.inspection;
    expect(inspection.appointmentJson).toContain(
      '\"status\": \"waiting-for-magic\"',
    );
    expect(inspection.warnings).toContain("想定外の予約状態が保存されています");
  });

  it("事故routeからowner IDをpet IDとして保存して警告する", async () => {
    await post(app, "/demo/reset");
    expect((await post(app, "/demo/incidents/swap-identifiers")).status).toBe(
      303,
    );

    const inspection = (await page(app)).props.incidentLab.inspection;
    expect(inspection.appointmentJson).toContain(
      `\"petId\": \"${clinicFixture.ownerId}\"`,
    );
    expect(inspection.warnings).toContain("飼い主 ID と動物 ID が同じ値です");
  });

  it("名前だけの入力境界から不正な検査結果を保存してしまう", async () => {
    await post(app, "/demo/reset");
    expect(
      (await post(app, "/demo/incidents/malformed-exam-result")).status,
    ).toBe(303);

    const appointmentJson = (await page(app)).props.incidentLab.inspection
      .appointmentJson;
    expect(appointmentJson).toContain('\"petId\": \"not-a-pet-id\"');
    expect(appointmentJson).toContain('\"items\": \"not-an-array\"');
  });

  it("存在しない予約をError本文で判定し状態不正noticeへ誤分類する", async () => {
    const response = await post(app, "/demo/incidents/missing-appointment");

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/?notice=invalid-state");
  });

  it("診察開始を繰り返すたびにDateとUUIDを処理内で生成してしまう", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-30T07:00:00.000Z"));
    const response = post(app, "/demo/incidents/repeat-start-examination");

    await vi.advanceTimersByTimeAsync(10);
    expect((await response).status).toBe(303);

    const auditLogs = JSON.parse(
      (await page(app)).props.incidentLab.inspection.auditLogJson,
    ) as Array<{ eventId: string; eventName: string; occurredAt: string }>;
    const repeatedLogs = auditLogs.slice(-2);

    expect(repeatedLogs.map(({ eventName }) => eventName)).toEqual([
      "examination.started",
      "examination.started",
    ]);
    expect(repeatedLogs[0]?.eventId).not.toBe(repeatedLogs[1]?.eventId);
    expect(repeatedLogs[0]?.occurredAt).not.toBe(repeatedLogs[1]?.occurredAt);
    expect(repeatedLogs[0]?.occurredAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(repeatedLogs[1]?.occurredAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("監査payloadに飼い主の連絡先を表示してしまう", async () => {
    const firstPage = await page(app);
    const auditLogJson = firstPage.props.incidentLab.inspection.auditLogJson;

    expect(auditLogJson).toContain(clinicFixture.ownerContact.ownerEmail);
    expect(auditLogJson).toContain(clinicFixture.ownerContact.ownerPhone);
    expect(firstPage.props.incidentLab.inspection.warnings).toContain(
      "予約の変更履歴に飼い主の連絡先が含まれています",
    );
  });

  it("5つの固定事故操作だけを表示する", async () => {
    const scenarios = (await page(app)).props.incidentLab.scenarios;

    expect(
      scenarios.map(({ action }: { action: { href: string } }) => action.href),
    ).toEqual([
      "/demo/incidents/unknown-status",
      "/demo/incidents/swap-identifiers",
      "/demo/incidents/malformed-exam-result",
      "/demo/incidents/missing-appointment",
      "/demo/incidents/repeat-start-examination",
    ]);
    expect(
      scenarios.every(
        ({ action }: { action: { method: string } }) =>
          action.method === "post",
      ),
    ).toBe(true);
  });

  it("電話フォロー依頼を固定noticeへリダイレクトする", async () => {
    const response = await post(app, "/follow-ups/request");

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/?notice=not-implemented");
  });

  it("reset後は同じfixtureの予約済み状態と初期監査へ戻る", async () => {
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
    expect(
      JSON.parse((await page(app)).props.incidentLab.inspection.auditLogJson),
    ).toHaveLength(1);
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
