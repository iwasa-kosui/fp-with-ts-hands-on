import type { SensitiveAuditPayloadViewed } from "../../../../domain/aggregate/auditEvent.js";
import type { AppointmentEvent } from "../../../../domain/appointment/appointmentEvent.js";
import type { ExamResultEvent } from "../../../../domain/examResult/examResultEvent.js";
import type { FollowUpRequested } from "../../../../domain/followUp/followUpRequested.js";
import type { OwnerEvent } from "../../../../domain/owner/ownerEvent.js";
import type { PetEvent } from "../../../../domain/pet/petEvent.js";
import type { SessionCreated, SessionDeleted } from "../../../../domain/session/sessionEvent.js";
import type {
  UserCreated,
  UserDeleted,
  UserPasswordReset,
  UserUpdated,
} from "../../../../domain/user/userEvent.js";

import { assertNever } from "../middleware/useCaseResponse.js";

type KnownEventName =
  | SensitiveAuditPayloadViewed["eventName"]
  | AppointmentEvent["eventName"]
  | ExamResultEvent["eventName"]
  | FollowUpRequested["eventName"]
  | OwnerEvent["eventName"]
  | PetEvent["eventName"]
  | SessionCreated["eventName"]
  | SessionDeleted["eventName"]
  | UserCreated["eventName"]
  | UserDeleted["eventName"]
  | UserPasswordReset["eventName"]
  | UserUpdated["eventName"]
  | "appointment.payment-recorded";

const knownEventNames = {
  "audit.sensitive-payload-viewed": true,
  "appointment.booked": true,
  "appointment.canceled": true,
  "appointment.checked-in": true,
  "appointment.deposit-received": true,
  "appointment.examination-completed": true,
  "appointment.examination-started": true,
  "appointment.final-settlement-recorded": true,
  "appointment.payment-recorded": true,
  "appointment.reception-note-updated": true,
  "appointment.updated": true,
  "appointment.veterinarian-reassigned": true,
  "appointment.walk-in-registered": true,
  "exam-result.deleted": true,
  "exam-result.recorded": true,
  "exam-result.updated": true,
  "follow-up.requested": true,
  "owner.created": true,
  "owner.deleted": true,
  "owner.updated": true,
  "pet.created": true,
  "pet.deleted": true,
  "pet.updated": true,
  "session.created": true,
  "session.deleted": true,
  "user.created": true,
  "user.deleted": true,
  "user.password-reset": true,
  "user.updated": true,
} as const satisfies Readonly<Record<KnownEventName, true>>;

const isKnownEventName = (eventName: string): eventName is KnownEventName =>
  Object.prototype.hasOwnProperty.call(knownEventNames, eventName);

const knownEventLabel = (eventName: KnownEventName): string => {
  switch (eventName) {
    case "user.created":
      return "ユーザーを登録";
    case "user.updated":
      return "ユーザーを更新";
    case "user.password-reset":
      return "パスワードを再設定";
    case "user.deleted":
      return "ユーザーを削除";
    case "session.created":
      return "セッションを開始";
    case "session.deleted":
      return "セッションを終了";
    case "owner.created":
      return "飼い主を登録";
    case "owner.updated":
      return "飼い主を更新";
    case "owner.deleted":
      return "飼い主を削除";
    case "pet.created":
      return "ペットを登録";
    case "pet.updated":
      return "ペットを更新";
    case "pet.deleted":
      return "ペットを削除";
    case "appointment.booked":
      return "予約を登録";
    case "appointment.updated":
      return "予約内容を更新";
    case "appointment.walk-in-registered":
      return "飛び込み受付を登録";
    case "appointment.veterinarian-reassigned":
      return "担当獣医師を変更";
    case "appointment.reception-note-updated":
      return "受付メモを更新";
    case "appointment.deposit-received":
      return "前受金を登録";
    case "appointment.checked-in":
      return "予約を受付";
    case "appointment.examination-started":
      return "診察を開始";
    case "appointment.examination-completed":
      return "診察を完了";
    case "appointment.payment-recorded":
    case "appointment.final-settlement-recorded":
      return "会計を記録";
    case "appointment.canceled":
      return "予約をキャンセル";
    case "exam-result.recorded":
      return "診察結果を記録";
    case "exam-result.updated":
      return "診察結果を更新";
    case "exam-result.deleted":
      return "診察結果を削除";
    case "follow-up.requested":
      return "フォローアップを依頼";
    case "audit.sensitive-payload-viewed":
      return "機微監査情報を開示";
    default:
      return assertNever(eventName);
  }
};

export type EventPresentation =
  | Readonly<{ kind: "Known"; label: string }>
  | Readonly<{ kind: "Unknown"; label: "機微イベント" }>;

export const eventPresentation = (eventName: string): EventPresentation =>
  isKnownEventName(eventName)
    ? { kind: "Known", label: knownEventLabel(eventName) }
    : { kind: "Unknown", label: "機微イベント" };
