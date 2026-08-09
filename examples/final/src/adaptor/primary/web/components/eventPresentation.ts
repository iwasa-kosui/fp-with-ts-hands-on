export type EventPresentation =
  | Readonly<{ kind: "Known"; label: string }>
  | Readonly<{ kind: "Unknown"; label: "機微イベント" }>;

export const eventPresentation = (eventName: string): EventPresentation => {
  switch (eventName) {
    case "user.created":
      return { kind: "Known", label: "ユーザーを登録" };
    case "user.updated":
      return { kind: "Known", label: "ユーザーを更新" };
    case "user.password-reset":
      return { kind: "Known", label: "パスワードを再設定" };
    case "user.deleted":
      return { kind: "Known", label: "ユーザーを削除" };
    case "session.created":
      return { kind: "Known", label: "セッションを開始" };
    case "session.deleted":
      return { kind: "Known", label: "セッションを終了" };
    case "owner.created":
      return { kind: "Known", label: "飼い主を登録" };
    case "owner.updated":
      return { kind: "Known", label: "飼い主を更新" };
    case "owner.deleted":
      return { kind: "Known", label: "飼い主を削除" };
    case "pet.created":
      return { kind: "Known", label: "ペットを登録" };
    case "pet.updated":
      return { kind: "Known", label: "ペットを更新" };
    case "pet.deleted":
      return { kind: "Known", label: "ペットを削除" };
    case "appointment.booked":
      return { kind: "Known", label: "予約を登録" };
    case "appointment.checked-in":
      return { kind: "Known", label: "予約を受付" };
    case "appointment.examination-started":
      return { kind: "Known", label: "診察を開始" };
    case "appointment.examination-completed":
      return { kind: "Known", label: "診察を完了" };
    case "appointment.payment-recorded":
      return { kind: "Known", label: "会計を記録" };
    case "appointment.canceled":
      return { kind: "Known", label: "予約をキャンセル" };
    case "exam-result.recorded":
      return { kind: "Known", label: "診察結果を記録" };
    case "exam-result.updated":
      return { kind: "Known", label: "診察結果を更新" };
    case "exam-result.deleted":
      return { kind: "Known", label: "診察結果を削除" };
    case "follow-up.requested":
      return { kind: "Known", label: "フォローアップを依頼" };
    case "audit.sensitive-payload-viewed":
      return { kind: "Known", label: "機微監査情報を開示" };
    default:
      return { kind: "Unknown", label: "機微イベント" };
  }
};
