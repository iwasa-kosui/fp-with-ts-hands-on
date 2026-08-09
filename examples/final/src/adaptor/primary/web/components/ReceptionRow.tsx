import { router } from "@inertiajs/react";
import type { FormEvent, ReactElement } from "react";

import type { ReceptionBoardRow } from "../../../../useCase/query/receptionBoardReader.js";
import { buttonClassName } from "./Button.js";
import { appointmentPresentation } from "./appointmentPresentation.js";
import { servicePresentation } from "./servicePresentation.js";
import { settlementPresentation } from "./settlementPresentation.js";
import { StatusBadge } from "./StatusBadge.js";

type Props = Readonly<{
  row: ReceptionBoardRow;
  onSubmittingChange?: ((submitting: boolean) => void) | undefined;
}>;

const jstTime = (timestamp: string | null): string => timestamp === null
  ? "—"
  : new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(timestamp));

const actionPath = (row: ReceptionBoardRow): string =>
  row.primaryAction === "CheckIn"
    ? `/appointments/${row.appointmentId}/check-in`
    : `/appointments/${row.appointmentId}/start-examination`;

const projectedAction = (row: ReceptionBoardRow, onSubmittingChange: (submitting: boolean) => void): ReactElement => {
  const detailsPath = `/appointments/${row.appointmentId}`;
  if (row.primaryAction === "OpenDetails" || row.primaryAction === "Settle") {
    return <a className={buttonClassName(row.primaryAction === "Settle" ? "primary" : "secondary")} href={detailsPath}>
      {row.primaryAction === "Settle" ? "会計へ" : "詳細を見る"}
    </a>;
  }
  const path = actionPath(row);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmittingChange(true);
    router.post(path, { expectedVersion: row.version }, { preserveScroll: true, preserveState: true, onFinish: () => onSubmittingChange(false) });
  };
  return <form action={path} method="post" onSubmit={submit}>
    <input name="expectedVersion" type="hidden" value={row.version} />
    <button className={buttonClassName()} type="submit">
      {row.primaryAction === "CheckIn" ? "受付する" : "診察を開始"}
    </button>
  </form>;
};

export const ReceptionRow = ({ row, onSubmittingChange = () => undefined }: Props): ReactElement => {
  const status = appointmentPresentation(row.appointmentStatus);
  const statusLabel = row.appointmentStatus === "Scheduled"
    ? "未受付"
    : row.appointmentStatus === "CheckedIn"
      ? "診察待ち"
      : status.label;
  return <article className="reception-row">
    <dl className="reception-row__details">
      <div><dt>予約時刻</dt><dd>{row.bookingKind === "WalkIn" ? "飛び込み" : jstTime(row.scheduledAt)}</dd></div>
      <div><dt>受付時刻</dt><dd>{jstTime(row.checkedInAt)}</dd></div>
      <div><dt>待ち時間</dt><dd>{row.waitingMinutes === null ? "—" : `${row.waitingMinutes}分`}</dd></div>
      <div><dt>飼い主</dt><dd>{row.ownerName}</dd></div>
      <div><dt>ペット</dt><dd>{row.petName}</dd></div>
      <div className="reception-row__note"><dt>受付メモ</dt><dd>{row.receptionNote ?? "なし"}</dd></div>
      <div><dt>診療メニュー</dt><dd>{servicePresentation(row.serviceCode)}</dd></div>
      <div><dt>担当医</dt><dd>{row.assignedVeterinarianName ?? "未定"}</dd></div>
      <div><dt>予約種別</dt><dd>{row.bookingKind === "Reserved" ? "予約" : "飛び込み"}</dd></div>
      <div><dt>診療状態</dt><dd><StatusBadge tone={status.tone}>{statusLabel}</StatusBadge></dd></div>
      <div><dt>支払状態</dt><dd>{settlementPresentation(row.settlementStatus)}</dd></div>
    </dl>
    <div className="reception-row__action">{projectedAction(row, onSubmittingChange)}</div>
  </article>;
};
