import { useForm } from "@inertiajs/react";

import type { VeterinarianId } from "../../../../../domain/appointment/veterinarianId.js";
import { buttonClassName } from "../../components/Button.js";
import {
  appointmentPresentation,
  bookingKindLabel,
  serviceLabel,
  settlementLabel,
} from "../../components/appointmentPresentation.js";
import { ErrorSummary, FieldError } from "../../components/FormErrors.js";
import { InlineAlert, Card } from "../../components/Surface.js";
import { StatusBadge } from "../../components/StatusBadge.js";
import type { SharedPageProps } from "../../pageProps.js";
import type {
  AppointmentActions,
  AppointmentPageView,
  AppointmentVeterinarianOption,
} from "../../routes/appointmentRoutes.js";
import Layout from "../Layout.js";

type Props = SharedPageProps &
  Readonly<{
    appointment: AppointmentPageView;
    actions: AppointmentActions;
    veterinarianId: VeterinarianId | null;
    veterinarians?: readonly AppointmentVeterinarianOption[];
  }>;

const submit = (form: ReturnType<typeof useForm>, path: string) =>
  (event: React.FormEvent) => {
    event.preventDefault();
    form.post(path, { forceFormData: true, preserveScroll: true });
  };

const stateDetails = (appointment: AppointmentPageView): React.ReactNode => {
  switch (appointment.kind) {
    case "Scheduled":
      return null;
    case "CheckedIn":
      return <><dt>受付日時</dt><dd>{appointment.checkedInAt}</dd></>;
    case "InExamination":
      return <>
        <dt>受付日時</dt><dd>{appointment.checkedInAt}</dd>
        <dt>担当獣医師</dt><dd>{appointment.veterinarianName}</dd>
        <dt>診察開始日時</dt><dd>{appointment.examinationStartedAt}</dd>
      </>;
    case "AwaitingPayment":
      return <>
        <dt>受付日時</dt><dd>{appointment.checkedInAt}</dd>
        <dt>担当獣医師</dt><dd>{appointment.veterinarianName}</dd>
        <dt>診察開始日時</dt><dd>{appointment.examinationStartedAt}</dd>
        <dt>診察完了日時</dt><dd>{appointment.examinationCompletedAt}</dd>
        <dt>進行状況</dt><dd>診察結果記録済み・会計待ち</dd>
      </>;
    case "Paid":
      return <>
        <dt>受付日時</dt><dd>{appointment.checkedInAt}</dd>
        <dt>担当獣医師</dt><dd>{appointment.veterinarianName}</dd>
        <dt>診察開始日時</dt><dd>{appointment.examinationStartedAt}</dd>
        <dt>診察完了日時</dt><dd>{appointment.examinationCompletedAt}</dd>
        <dt>支払額</dt><dd>{appointment.amount} 円</dd>
        <dt>会計日時</dt><dd>{appointment.paidAt}</dd>
      </>;
    case "Canceled":
      return <><dt>キャンセル日時</dt><dd>{appointment.canceledAt}</dd></>;
    default:
      return appointment satisfies never;
  }
};

export default function AppointmentShow({
  actions,
  appointment,
  auth,
  errors,
  veterinarianId,
  veterinarians = [],
}: Props) {
  const base = `/appointments/${appointment.appointmentId}`;
  const presentation = appointmentPresentation(appointment.kind);
  const checkIn = useForm({ expectedVersion: appointment.version });
  const receptionNote = useForm({
    expectedVersion: appointment.version,
    receptionNote: appointment.receptionNote ?? "",
  });
  const deposit = useForm({ expectedVersion: appointment.version, depositAmount: "" });
  const startExam = useForm({
    expectedVersion: appointment.version,
    veterinarianId: appointment.assignedVeterinarianId ?? veterinarianId ?? "",
  });
  const exam = useForm<{
    expectedVersion: number;
    petId: string;
    collectedAt: string;
    item: string;
    needsFollowUp: boolean;
  }>({
    expectedVersion: appointment.version,
    petId: appointment.petId,
    collectedAt:
      appointment.kind === "InExamination"
        ? appointment.examinationStartedAt
        : appointment.scheduledAt,
    item: "",
    needsFollowUp: false,
  });
  const payment = useForm({
    expectedVersion: appointment.version,
    diagnosis: "",
    treatment: "",
    finalAmount: "",
  });
  const cancellation = useForm({ expectedVersion: appointment.version, reason: "" });
  const receivedDeposit = appointment.settlement.kind === "DepositReceived"
    ? appointment.settlement.depositAmount
    : 0;
  const enteredFinalAmount = Number(payment.data.finalAmount);
  const settlementPreview = Number.isFinite(enteredFinalAmount) && enteredFinalAmount > 0
    ? enteredFinalAmount > receivedDeposit
      ? `${enteredFinalAmount - receivedDeposit} 円を受け取って精算`
      : enteredFinalAmount < receivedDeposit
        ? `${receivedDeposit - enteredFinalAmount} 円を返金して精算`
        : "差額なしで精算"
    : null;
  const refundsDeposit = appointment.settlement.kind === "DepositReceived";
  const submitCancellation = (event: React.FormEvent) => {
    event.preventDefault();
    if (window.confirm(refundsDeposit
      ? "前受金を全額返金してキャンセルしますか？"
      : "この予約をキャンセルしますか？")) {
      cancellation.post(`${base}/cancel`, {
        forceFormData: true,
        preserveScroll: true,
      });
    }
  };
  const hasAvailableAction =
    actions.checkIn ||
    actions.cancel ||
    actions.startExamination ||
    actions.recordExamResult ||
    actions.updateReceptionNote ||
    actions.receiveDeposit ||
    actions.settle;

  return (
    <Layout activeNavigation="appointments" title="予約詳細" user={auth.user}>
      <ErrorSummary errors={errors} />
      <div className="appointment-workspace">
        <section aria-label="予約情報" className="appointment-summary">
          <Card>
            <div className="appointment-summary__status">
              <StatusBadge tone={presentation.tone}>{presentation.label}</StatusBadge>
            </div>
            <dl>
              <dt>開始日時</dt><dd>{appointment.scheduledAt}</dd>
              <dt>終了日時</dt><dd>{appointment.scheduledEndsAt}</dd>
              <dt>飼い主</dt><dd>{appointment.ownerName}</dd>
              <dt>ペット</dt><dd>{appointment.petName}</dd>
              <dt>診療メニュー</dt><dd>{serviceLabel(appointment.serviceCode)}</dd>
              <dt>予約種別</dt><dd>{bookingKindLabel(appointment.bookingKind)}</dd>
              <dt>担当獣医師</dt><dd>{appointment.assignedVeterinarianName}</dd>
              <dt>来院理由</dt><dd>{appointment.visitReason}</dd>
              <dt>受付メモ</dt><dd>{appointment.receptionNote ?? "なし"}</dd>
              <dt>支払状態</dt><dd>{settlementLabel(appointment.settlement)}</dd>
              {stateDetails(appointment)}
            </dl>
          </Card>
        </section>

        <aside aria-label="現在の操作" className="workflow-panel">
          <Card>
            {hasAvailableAction ? null : (
              <InlineAlert>現在実行できる操作はありません</InlineAlert>
            )}
            {actions.checkIn ? (
              <form className="workflow-primary" onSubmit={submit(checkIn, `${base}/check-in`)}>
                <input name="expectedVersion" type="hidden" value={checkIn.data.expectedVersion} />
                <button
                  aria-busy={checkIn.processing || undefined}
                  className={buttonClassName()}
                  disabled={checkIn.processing}
                  type="submit"
                >
                  {checkIn.processing ? "受付中…" : "受付する"}
                </button>
              </form>
            ) : null}

            {actions.updateReceptionNote ? (
              <form className="workflow-primary" onSubmit={submit(receptionNote, `${base}/reception-note`)}>
                <input name="expectedVersion" type="hidden" value={receptionNote.data.expectedVersion} />
                <label htmlFor="receptionNote">受付メモ
                  <textarea
                    id="receptionNote"
                    name="receptionNote"
                    onChange={(event) => receptionNote.setData("receptionNote", event.target.value)}
                    value={receptionNote.data.receptionNote}
                  />
                </label>
                <FieldError field="receptionNote" message={errors.receptionNote} />
                <button className={buttonClassName("secondary")} disabled={receptionNote.processing} type="submit">
                  {receptionNote.processing ? "更新中…" : "受付メモを更新"}
                </button>
              </form>
            ) : null}

            {actions.receiveDeposit ? (
              <form className="workflow-primary" onSubmit={submit(deposit, `${base}/deposit`)}>
                <input name="expectedVersion" type="hidden" value={deposit.data.expectedVersion} />
                <label htmlFor="depositAmount">前受金額（円）
                  <input
                    id="depositAmount"
                    min="1"
                    name="depositAmount"
                    onChange={(event) => deposit.setData("depositAmount", event.target.value)}
                    type="number"
                    value={deposit.data.depositAmount}
                  />
                </label>
                <FieldError field="depositAmount" message={errors.depositAmount} />
                <button className={buttonClassName()} disabled={deposit.processing} type="submit">
                  {deposit.processing ? "登録中…" : "前受金を登録"}
                </button>
              </form>
            ) : null}

            {actions.startExamination ? (
              <form className="workflow-primary" onSubmit={submit(startExam, `${base}/start-examination`)}>
          <input name="expectedVersion" type="hidden" value={startExam.data.expectedVersion} />
          {auth.user?.role === "Admin" && appointment.assignedVeterinarianId === null ? (
            <>
              <label htmlFor="veterinarianId">
                担当獣医師 ID
                <select
                  aria-describedby={errors.veterinarianId === undefined ? undefined : "veterinarianId-error"}
                  aria-invalid={errors.veterinarianId === undefined ? undefined : true}
                  id="veterinarianId"
                  name="veterinarianId"
                  onChange={(event) => startExam.setData("veterinarianId", event.target.value)}
                  value={startExam.data.veterinarianId}
                >
                  <option value="">選択してください</option>
                  {veterinarians.map((veterinarian) => (
                    <option
                      key={veterinarian.veterinarianId}
                      value={veterinarian.veterinarianId}
                    >
                      {veterinarian.name}
                    </option>
                  ))}
                </select>
              </label>
              <FieldError field="veterinarianId" message={errors.veterinarianId} />
            </>
          ) : null}
                <button
                  aria-busy={startExam.processing || undefined}
                  className={buttonClassName()}
                  disabled={startExam.processing}
                  type="submit"
                >
                  {startExam.processing ? "開始中…" : "診察を開始"}
                </button>
              </form>
            ) : null}

            {actions.recordExamResult ? (
              <form className="workflow-primary" onSubmit={submit(exam, `${base}/exam-results`)}>
          <input name="expectedVersion" type="hidden" value={exam.data.expectedVersion} />
          <input name="petId" type="hidden" value={exam.data.petId} />
          <label htmlFor="collectedAt">
            採取日時（ISO 8601）
            <input
              aria-describedby={errors.collectedAt === undefined ? undefined : "collectedAt-error"}
              aria-invalid={errors.collectedAt === undefined ? undefined : true}
              id="collectedAt"
              name="collectedAt"
              onChange={(event) => exam.setData("collectedAt", event.target.value)}
              value={exam.data.collectedAt}
            />
          </label>
          <FieldError field="collectedAt" message={errors.collectedAt} />
          <label htmlFor="item">
            診察結果
            <textarea
              aria-describedby={errors.item === undefined ? undefined : "item-error"}
              aria-invalid={errors.item === undefined ? undefined : true}
              id="item"
              name="item"
              onChange={(event) => exam.setData("item", event.target.value)}
              value={exam.data.item}
            />
          </label>
          <FieldError field="item" message={errors.item} />
          <label>
            <input
              aria-describedby={errors.needsFollowUp === undefined ? undefined : "needsFollowUp-error"}
              aria-invalid={errors.needsFollowUp === undefined ? undefined : true}
              checked={exam.data.needsFollowUp}
              name="needsFollowUp"
              onChange={(event) => exam.setData("needsFollowUp", event.target.checked)}
              type="checkbox"
            />
            電話フォローが必要
          </label>
          <FieldError field="needsFollowUp" message={errors.needsFollowUp} />
                <button
                  aria-busy={exam.processing || undefined}
                  className={buttonClassName()}
                  disabled={exam.processing}
                  type="submit"
                >
                  {exam.processing ? "記録中…" : "診察結果を記録"}
                </button>
              </form>
            ) : null}

            {actions.settle ? (
              <form className="workflow-primary" onSubmit={submit(payment, `${base}/payment`)}>
          <input name="expectedVersion" type="hidden" value={payment.data.expectedVersion} />
          {(["diagnosis", "treatment", "finalAmount"] as const).map((field) => (
            <div key={field}>
              <label htmlFor={field}>
                {field === "diagnosis" ? "診断" : field === "treatment" ? "処置" : "最終請求額（円）"}
                <input
                  aria-describedby={errors[field] === undefined ? undefined : `${field}-error`}
                  aria-invalid={errors[field] === undefined ? undefined : true}
                  id={field}
                  name={field}
                  onChange={(event) => payment.setData(field, event.target.value)}
                  type={field === "finalAmount" ? "number" : "text"}
                  value={payment.data[field]}
                />
              </label>
              <FieldError field={field} message={errors[field]} />
            </div>
          ))}
                {settlementPreview === null ? null : <InlineAlert>{settlementPreview}</InlineAlert>}
                <button
                  aria-busy={payment.processing || undefined}
                  className={buttonClassName()}
                  disabled={payment.processing}
                  type="submit"
                >
                  {payment.processing ? "記録中…" : "会計を記録"}
                </button>
              </form>
            ) : null}

            {actions.cancel ? (
              <form className="danger-zone" onSubmit={submitCancellation}>
          <input name="expectedVersion" type="hidden" value={cancellation.data.expectedVersion} />
          <label htmlFor="reason">
            キャンセル理由
            <textarea
              aria-describedby={errors.reason === undefined ? undefined : "reason-error"}
              aria-invalid={errors.reason === undefined ? undefined : true}
              id="reason"
              name="reason"
              onChange={(event) => cancellation.setData("reason", event.target.value)}
              value={cancellation.data.reason}
            />
          </label>
          <FieldError field="reason" message={errors.reason} />
                <button
                  aria-busy={cancellation.processing || undefined}
                  className={buttonClassName("danger")}
                  disabled={cancellation.processing}
                  type="submit"
                >
                  {cancellation.processing
                    ? "処理中…"
                    : refundsDeposit
                      ? "前受金を全額返金してキャンセル"
                      : "予約をキャンセル"}
                </button>
              </form>
            ) : null}
          </Card>
        </aside>
      </div>
    </Layout>
  );
}
