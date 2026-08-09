import { useForm } from "@inertiajs/react";

import type { VeterinarianId } from "../../../../../domain/appointment/veterinarianId.js";
import { ErrorSummary, FieldError } from "../../components/FormErrors.js";
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
  const checkIn = useForm({});
  const startExam = useForm({ veterinarianId: veterinarianId ?? "" });
  const exam = useForm<{
    petId: string;
    collectedAt: string;
    item: string;
    needsFollowUp: boolean;
  }>({
    petId: appointment.petId,
    collectedAt:
      appointment.kind === "InExamination"
        ? appointment.examinationStartedAt
        : appointment.scheduledAt,
    item: "",
    needsFollowUp: false,
  });
  const payment = useForm({ diagnosis: "", treatment: "", amount: "" });
  const cancellation = useForm({ reason: "" });
  const submitCancellation = (event: React.FormEvent) => {
    event.preventDefault();
    if (window.confirm("この予約をキャンセルしますか？")) {
      cancellation.post(`${base}/cancel`, {
        forceFormData: true,
        preserveScroll: true,
      });
    }
  };

  return (
    <Layout title="予約詳細" user={auth.user}>
      <ErrorSummary errors={errors} />
      <dl>
        <dt>状態</dt><dd>{appointment.kind}</dd>
        <dt>予約日時</dt><dd>{appointment.scheduledAt}</dd>
        <dt>飼い主</dt><dd>{appointment.ownerName}</dd>
        <dt>ペット</dt><dd>{appointment.petName}</dd>
        {stateDetails(appointment)}
      </dl>

      {actions.checkIn ? (
        <form onSubmit={submit(checkIn, `${base}/check-in`)}>
          <button disabled={checkIn.processing} type="submit">
            {checkIn.processing ? "受付中…" : "受付する"}
          </button>
        </form>
      ) : null}

      {actions.startExamination ? (
        <form onSubmit={submit(startExam, `${base}/start-examination`)}>
          {auth.user?.role === "Admin" ? (
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
          <button disabled={startExam.processing} type="submit">
            {startExam.processing ? "開始中…" : "診察を開始"}
          </button>
        </form>
      ) : null}

      {actions.recordExamResult ? (
        <form onSubmit={submit(exam, `${base}/exam-results`)}>
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
          <button disabled={exam.processing} type="submit">
            {exam.processing ? "記録中…" : "診察結果を記録"}
          </button>
        </form>
      ) : null}

      {actions.recordPayment ? (
        <form onSubmit={submit(payment, `${base}/payment`)}>
          {(["diagnosis", "treatment", "amount"] as const).map((field) => (
            <div key={field}>
              <label htmlFor={field}>
                {field === "diagnosis" ? "診断" : field === "treatment" ? "処置" : "支払額（円）"}
                <input
                  aria-describedby={errors[field] === undefined ? undefined : `${field}-error`}
                  aria-invalid={errors[field] === undefined ? undefined : true}
                  id={field}
                  name={field}
                  onChange={(event) => payment.setData(field, event.target.value)}
                  type={field === "amount" ? "number" : "text"}
                  value={payment.data[field]}
                />
              </label>
              <FieldError field={field} message={errors[field]} />
            </div>
          ))}
          <button disabled={payment.processing} type="submit">
            {payment.processing ? "記録中…" : "会計を記録"}
          </button>
        </form>
      ) : null}

      {actions.cancel ? (
        <form onSubmit={submitCancellation}>
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
          <button disabled={cancellation.processing} type="submit">
            {cancellation.processing ? "処理中…" : "予約をキャンセル"}
          </button>
        </form>
      ) : null}
    </Layout>
  );
}
