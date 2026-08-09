import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";

import ReceptionIndex from "../../src/adaptor/primary/web/pages/Reception/Index.js";
import { Timestamp } from "../../src/domain/aggregate/timestamp.js";
import { AppointmentId } from "../../src/domain/appointment/appointmentId.js";
import { AppointmentVersion } from "../../src/domain/appointment/appointmentVersion.js";
import { BusinessDate } from "../../src/domain/appointment/businessDate.js";
import { UserId } from "../../src/domain/user/userId.js";
import type { ReceptionBoard, ReceptionBoardRow } from "../../src/useCase/query/receptionBoardReader.js";

const row = (suffix: string, appointmentStatus: ReceptionBoardRow["appointmentStatus"], primaryAction: ReceptionBoardRow["primaryAction"], overrides: Partial<ReceptionBoardRow> = {}): ReceptionBoardRow => ({
  appointmentId: AppointmentId.schema.parse(`93000000-0000-4000-8000-0000000000${suffix}`),
  version: AppointmentVersion.schema.parse(3),
  bookingKind: "Reserved",
  scheduledAt: Timestamp.schema.parse("2026-08-09T01:00:00.000Z"),
  checkedInAt: appointmentStatus === "Scheduled" ? null : Timestamp.schema.parse("2026-08-09T01:05:00.000Z"),
  waitingMinutes: appointmentStatus === "Scheduled" ? null : 25,
  ownerName: "山田 花子",
  petName: "むぎ",
  serviceCode: "GeneralConsultation",
  assignedVeterinarianName: "佐藤 獣医師",
  appointmentStatus,
  settlementStatus: appointmentStatus === "Paid" ? "Settled" : "NoPayment",
  primaryAction,
  ...overrides,
});
const board: ReceptionBoard = {
  businessDate: BusinessDate.schema.parse("2026-08-09"),
  loadedAt: Timestamp.schema.parse("2026-08-09T03:00:00.000Z"),
  scheduled: [row("11", "Scheduled", "CheckIn")],
  checkedIn: [row("21", "CheckedIn", "StartExamination", { bookingKind: "WalkIn" })],
  inExamination: [row("31", "InExamination", "OpenDetails")],
  awaitingPayment: [row("41", "AwaitingPayment", "Settle")],
  paid: [row("51", "Paid", "OpenDetails")],
  canceled: [row("61", "Canceled", "OpenDetails")],
};
const props = {
  auth: { user: { userId: UserId.schema.parse("93000000-0000-4000-8000-000000000001"), role: "Admin" as const } },
  errors: {}, flash: {}, board, currentTime: Timestamp.schema.parse("2026-08-09T03:00:00.000Z"),
};

describe("ReceptionIndex SSR", () => {
  test("renders a vertical six-section Japanese board with paid and canceled collapsed", () => {
    const html = renderToString(createElement(ReceptionIndex, props)).replaceAll("<!-- -->", "");

    for (const label of ["予約済", "受付済", "診察中", "会計待ち", "完了", "キャンセル"]) expect(html).toContain(label);
    expect((html.match(/class="reception-section reception-section--/g) ?? [])).toHaveLength(6);
    expect(html).toContain("予約時刻");
    expect(html).toContain("受付時刻");
    expect(html).toContain("待ち時間");
    expect(html).toContain("飼い主");
    expect(html).toContain("ペット");
    expect(html).toContain("一般診療");
    expect(html).toContain("飛び込み");
    expect(html).toContain("未精算");
    expect(html).toContain("最終更新 2026年8月9日 12:00:00");
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('<details class="reception-section reception-section--scheduled" open="">');
    expect(html).toContain('<details class="reception-section reception-section--paid">');
    expect(html).toContain('<details class="reception-section reception-section--canceled">');
  });

  test("renders no-JS-capable projected actions with expectedVersion and sends settlement to details", () => {
    const html = renderToString(createElement(ReceptionIndex, props));

    expect(html).toContain(`action="/appointments/${board.scheduled[0]?.appointmentId}/check-in"`);
    expect(html).toContain(`action="/appointments/${board.checkedIn[0]?.appointmentId}/start-examination"`);
    expect(html).toContain('name="expectedVersion"');
    expect(html).toContain('value="3"');
    expect(html).toContain("受付する");
    expect(html).toContain("診察を開始");
    expect(html).toContain(`href="/appointments/${board.awaitingPayment[0]?.appointmentId}"`);
    expect(html).toContain("会計へ");
    expect(html).not.toContain("受付メモ");
    expect(html).not.toContain("来院理由");
    expect(html).not.toContain("診断");
  });

  test("keeps reception navigation separate from the appointment calendar", () => {
    const html = renderToString(createElement(ReceptionIndex, props));
    expect(html).toContain('href="/appointments"');
    expect(html).toContain('href="/reception"');
    expect(html).toContain('aria-current="page"');
  });
});
