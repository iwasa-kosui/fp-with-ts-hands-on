import type { ClinicPageProps, IncidentScenario } from "@fp-with-ts/clinic-web";
import { noticeFromCode } from "@fp-with-ts/clinic-web/server";

import type { AuditLog } from "../adaptor/secondary/sqlite/appointmentStore.js";
import type { Appointment } from "../domain/appointment/appointment.js";
import { toStatusLabel } from "../domain/appointment/statusLabel.js";

const statusKinds: Readonly<Record<string, string>> = {
  scheduled: "Scheduled",
  "checked-in": "CheckedIn",
  "in-examination": "InExamination",
  "awaiting-payment": "AwaitingPayment",
  paid: "Paid",
  canceled: "Canceled",
};

const incidentScenarios: readonly IncidentScenario[] = [
  {
    title: "未知の状態を保存",
    description: "定義されていないwaiting-for-magicを予約statusへ保存します。",
    action: {
      kind: "Available",
      href: "/demo/incidents/unknown-status",
      method: "post",
    },
  },
  {
    title: "IDを取り違えて保存",
    description: "ownerIdをpetIdとして予約へ保存します。",
    action: {
      kind: "Available",
      href: "/demo/incidents/swap-identifiers",
      method: "post",
    },
  },
  {
    title: "不正な診察結果を保存",
    description: "petIdとitemsが不正な入力を検証せず予約へ保存します。",
    action: {
      kind: "Available",
      href: "/demo/incidents/malformed-exam-result",
      method: "post",
    },
  },
  {
    title: "存在しない予約で診察開始",
    description: "予約なしの失敗を状態不正として誤って表示します。",
    action: {
      kind: "Available",
      href: "/demo/incidents/missing-appointment",
      method: "post",
    },
  },
  {
    title: "診察開始を繰り返す",
    description: "処理内で生成される時刻と監査event IDの違いを表示します。",
    action: {
      kind: "Available",
      href: "/demo/incidents/repeat-start-examination",
      method: "post",
    },
  },
  {
    title: "監査追記だけを失敗",
    description: "予約更新後に監査追記を失敗させ、不整合を残します。",
    action: {
      kind: "Available",
      href: "/demo/incidents/audit-failure",
      method: "post",
    },
  },
];

const inspectionWarnings = (
  appointment: Appointment,
  auditLogs: readonly AuditLog[],
): readonly string[] => {
  const warnings: string[] = [];

  if (!(appointment.status in statusKinds)) {
    warnings.push("未知の予約statusが保存されています");
  }
  if (appointment.ownerId === appointment.petId) {
    warnings.push("ownerIdとpetIdが同じ値です");
  }

  const latestAudit = auditLogs.at(-1);
  if (
    latestAudit !== undefined &&
    latestAudit.payload.status !== appointment.status
  ) {
    warnings.push("予約statusに対応する最新の監査記録がありません");
  }
  if (
    auditLogs.some(
      ({ payload }) =>
        payload.ownerEmail !== undefined || payload.ownerPhone !== undefined,
    )
  ) {
    warnings.push("監査payloadに飼い主の連絡先が含まれています");
  }

  return warnings;
};

export const toPageProps = (
  appointment: Appointment,
  auditLogs: readonly AuditLog[],
  noticeCode: string | undefined,
): ClinicPageProps => {
  const action = (href: string) =>
    ({ kind: "Available", href, method: "post" }) as const;
  const appointmentUrl = `/appointments/${appointment.appointmentId}`;

  return {
    sessionLabel: "Session 00",
    learningFocus: "型で守られていない業務事故を観察する",
    appointment: {
      appointmentId: appointment.appointmentId,
      kind: statusKinds[appointment.status] ?? appointment.status,
      ownerName: appointment.ownerName,
      petName: appointment.petName,
      scheduledAt: appointment.scheduledAt,
      statusLabel: toStatusLabel(appointment),
    },
    actions: {
      checkIn: action(`${appointmentUrl}/check-in`),
      startExamination: action(`${appointmentUrl}/start-examination`),
      recordExamResult: action(`${appointmentUrl}/exam-results`),
      recordPayment: action(`${appointmentUrl}/payment`),
      cancel: action(`${appointmentUrl}/cancel`),
      requestFollowUp: {
        kind: "NotImplemented",
        href: "/follow-ups/request",
        method: "post",
      },
    },
    notice: noticeFromCode(noticeCode),
    incidentLab: {
      scenarios: incidentScenarios,
      inspection: {
        appointmentJson: JSON.stringify(appointment, null, 2),
        auditLogJson: JSON.stringify(auditLogs, null, 2),
        warnings: inspectionWarnings(appointment, auditLogs),
      },
    },
  };
};
