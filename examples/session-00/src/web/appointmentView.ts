import { isDeepStrictEqual } from "node:util";

import type { ClinicPageProps, IncidentScenario } from "@fp-with-ts/clinic-web";
import { noticeFromCode } from "@fp-with-ts/clinic-web/server";

import type { AuditLog } from "../adaptor/secondary/sqlite/appointmentRepository.js";
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

const toStatusKind = (status: string): string => {
  const kind = Object.hasOwn(statusKinds, status)
    ? statusKinds[status]
    : undefined;

  return kind ?? status;
};

const incidentScenarios: readonly IncidentScenario[] = [
  {
    title: "想定外の予約状態を保存",
    description: "システムで定義していないwaiting-for-magicという予約状態を保存します。",
    action: {
      kind: "Available",
      href: "/demo/incidents/unknown-status",
      method: "post",
    },
  },
  {
    title: "IDを取り違えて保存",
    description: "飼い主 ID を動物 ID として予約へ保存します。",
    action: {
      kind: "Available",
      href: "/demo/incidents/swap-identifiers",
      method: "post",
    },
  },
  {
    title: "不正な診察結果を保存",
    description: "動物 ID と診察項目が不正な入力を、検査せず予約へ保存します。",
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
    description: "診察開始のたびに別の時刻と履歴 ID が作られる様子を表示します。",
    action: {
      kind: "Available",
      href: "/demo/incidents/repeat-start-examination",
      method: "post",
    },
  },
];

const inspectionWarnings = (
  appointment: Appointment,
  auditLogs: readonly AuditLog[],
): readonly string[] => {
  const warnings: string[] = [];

  if (!Object.hasOwn(statusKinds, appointment.status)) {
    warnings.push("想定外の予約状態が保存されています");
  }
  if (appointment.ownerId === appointment.petId) {
    warnings.push("飼い主 ID と動物 ID が同じ値です");
  }

  const latestAudit = auditLogs.at(-1);
  if (
    latestAudit === undefined ||
    !isDeepStrictEqual(latestAudit.payload, appointment)
  ) {
    warnings.push("現在の予約内容に対応する変更履歴がありません");
  }
  if (
    auditLogs.some(
      ({ payload }) =>
        payload.ownerEmail !== undefined || payload.ownerPhone !== undefined,
    )
  ) {
    warnings.push("予約の変更履歴に飼い主の連絡先が含まれています");
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
      kind: toStatusKind(appointment.status),
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
