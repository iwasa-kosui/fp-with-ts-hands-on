import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  ClinicDashboard,
  type ClinicPageProps,
} from "../src/index.js";

const available = {
  kind: "Available",
  href: "/available",
  method: "post",
} as const;

const hidden = { kind: "Hidden" } as const;

const notImplemented = {
  kind: "NotImplemented",
  href: "/follow-ups/request",
  method: "post",
} as const;

const props: ClinicPageProps = {
  sessionLabel: "Session 02",
  learningFocus: "状態遷移を型で守る",
  appointment: {
    appointmentId: "11111111-1111-4111-8111-111111111111",
    kind: "Scheduled",
    ownerName: "田中 花子",
    petName: "こむぎ",
    scheduledAt: "2026-08-28T10:00:00.000Z",
    statusLabel: "予約済み",
  },
  actions: {
    checkIn: available,
    startExamination: hidden,
    recordExamResult: hidden,
    recordPayment: hidden,
    cancel: hidden,
    requestFollowUp: notImplemented,
  },
  notice: null,
};

describe("ClinicDashboard", () => {
  it("未実装操作を区別し、Hidden操作を描画しない", () => {
    const html = renderToStaticMarkup(<ClinicDashboard {...props} />);

    expect(html).toContain("受付する");
    expect(html).toContain("未実装");
    expect(html).toContain("電話フォローを依頼");
    expect(html).not.toContain("キャンセルする");
  });

  it("固定された未実装メッセージをdialogへ表示する", () => {
    const html = renderToStaticMarkup(
      <ClinicDashboard
        {...props}
        notice={{ kind: "FeatureNotImplemented" }}
      />,
    );

    expect(html).toContain('<dialog class="notice-dialog" open="">');
    expect(html).toContain("この機能は未実装です");
  });

  it("既知の業務失敗も固定メッセージへ変換する", () => {
    const html = renderToStaticMarkup(
      <ClinicDashboard
        {...props}
        notice={{ kind: "InvalidAppointmentState" }}
      />,
    );

    expect(html).toContain("現在の予約状態ではこの操作を実行できません");
  });

  it("事故再現用propsがあるとシナリオとDB検査結果を表示する", () => {
    const html = renderToStaticMarkup(
      <ClinicDashboard
        {...props}
        incidentLab={{
          scenarios: [
            {
              title: "未知の状態を保存する",
              description: "statusへ定義されていない文字列を保存します。",
              action: {
                kind: "Available",
                href: "/demo/incidents/unknown-status",
                method: "post",
              },
            },
          ],
          inspection: {
            appointmentJson: '{"status":"waiting-for-magic"}',
            auditLogJson: '[{"eventName":"appointment.updated"}]',
            warnings: ["未知の状態が保存されています"],
          },
        }}
      />,
    );

    expect(html).toContain("事故再現");
    expect(html).toContain("未知の状態を保存する");
    expect(html).toContain("statusへ定義されていない文字列を保存します。");
    expect(html).toContain("実行する");
    expect(html).toContain("DBに保存された予約");
    expect(html).toContain("{&quot;status&quot;:&quot;waiting-for-magic&quot;}");
    expect(html).toContain("DBに保存された監査ログ");
    expect(html).toContain("[{&quot;eventName&quot;:&quot;appointment.updated&quot;}]");
    expect(html).toContain("未知の状態が保存されています");
  });

  it("事故再現用propsがないと事故再現とDB検査結果を表示しない", () => {
    const html = renderToStaticMarkup(<ClinicDashboard {...props} />);

    expect(html).not.toContain("事故再現");
    expect(html).not.toContain("DBに保存された予約");
  });
});
