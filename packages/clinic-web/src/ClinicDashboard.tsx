import { router } from "@inertiajs/react";
import type { ReactElement } from "react";

import type {
  ActionAvailability,
  AppointmentActions,
  ClinicPageProps,
  IncidentLab,
  Notice,
} from "./contracts.js";

type ActionKey = keyof AppointmentActions;

const actionLabels: Readonly<Record<ActionKey, string>> = {
  checkIn: "受付する",
  startExamination: "診察を開始する",
  recordExamResult: "診察結果を記録する",
  recordPayment: "会計を記録する",
  cancel: "キャンセルする",
  requestFollowUp: "電話フォローを依頼する",
};

const noticeMessages: Readonly<
  Record<Exclude<Notice, null>["kind"], string>
> = {
  FeatureNotImplemented: "この機能は未実装です",
  InvalidAppointmentState: "現在の予約状態ではこの操作を実行できません",
  AppointmentNotFound: "予約が見つかりません",
  AppointmentConflict: "予約がほかの操作によって更新されました",
};

const visit = (action: Exclude<ActionAvailability, { kind: "Hidden" }>): void => {
  router.visit(action.href, {
    method: action.method,
    data: action.data ?? {},
    preserveScroll: true,
  });
};

const ActionButton = ({
  action,
  label,
}: Readonly<{
  action: ActionAvailability;
  label: string;
}>): ReactElement | null => {
  if (action.kind === "Hidden") {
    return null;
  }

  const isNotImplemented = action.kind === "NotImplemented";
  return (
    <button
      className={
        isNotImplemented
          ? "button button--secondary clinic-action clinic-action--not-implemented"
          : "button button--primary clinic-action"
      }
      onClick={() => visit(action)}
      type="button"
    >
      <span>{label}</span>
      {isNotImplemented ? (
        <span className="clinic-action__status">未実装</span>
      ) : null}
    </button>
  );
};

const NoticeDialog = ({ notice }: Readonly<{ notice: Notice }>): ReactElement | null =>
  notice === null ? null : (
    <dialog className="notice-dialog" open>
      <h2>操作のお知らせ</h2>
      <p>{noticeMessages[notice.kind]}</p>
      <button
        className="button button--primary"
        onClick={() => router.visit("/", { replace: true })}
        type="button"
      >
        閉じる
      </button>
    </dialog>
  );

const IncidentLabPanel = ({
  incidentLab,
}: Readonly<{
  incidentLab: IncidentLab;
}>): ReactElement => (
  <section
    className="surface-card clinic-incident-lab"
    aria-labelledby="incident-lab-heading"
  >
    <h2 id="incident-lab-heading">事故再現</h2>
    <div className="clinic-incident-lab__scenarios">
      {incidentLab.scenarios.map((scenario) => (
        <article className="clinic-incident-scenario" key={scenario.title}>
          <div>
            <h3>{scenario.title}</h3>
            <p>{scenario.description}</p>
          </div>
          <ActionButton action={scenario.action} label="実行する" />
        </article>
      ))}
    </div>
    <div className="clinic-database-inspection">
      <section aria-labelledby="database-appointment-heading">
        <h3 id="database-appointment-heading">現在の予約内容</h3>
        <pre>{incidentLab.inspection.appointmentJson}</pre>
      </section>
      <section aria-labelledby="database-audit-log-heading">
        <h3 id="database-audit-log-heading">予約の変更履歴</h3>
        <pre>{incidentLab.inspection.auditLogJson}</pre>
      </section>
      <section aria-labelledby="database-warnings-heading">
        <h3 id="database-warnings-heading">不整合の警告</h3>
        <ul>
          {incidentLab.inspection.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      </section>
    </div>
  </section>
);

export const ClinicDashboard = ({
  actions,
  appointment,
  incidentLab,
  learningFocus,
  notice,
  sessionLabel,
}: ClinicPageProps): ReactElement => (
  <main className="clinic-demo">
    <header className="page-header clinic-demo__header">
      <div>
        <p className="clinic-demo__session">{sessionLabel}</p>
        <h1>関数型どうぶつ病院</h1>
        <p className="page-header__description">{learningFocus}</p>
      </div>
      <form action="/demo/reset" method="post">
        <button className="button button--ghost" type="submit">
          デモを初期状態へ戻す
        </button>
      </form>
    </header>

    <section className="surface-card clinic-appointment" aria-labelledby="appointment-heading">
      <div className="clinic-appointment__heading">
        <div>
          <p className="clinic-appointment__eyebrow">本日の予約</p>
          <h2 id="appointment-heading">{appointment.petName}</h2>
        </div>
        <span className="status-badge status-badge--info">
          {appointment.statusLabel}
        </span>
      </div>
      <dl className="clinic-appointment__details">
        <div>
          <dt>予約ID</dt>
          <dd>{appointment.appointmentId}</dd>
        </div>
        <div>
          <dt>飼い主</dt>
          <dd>{appointment.ownerName}</dd>
        </div>
        <div>
          <dt>予約日時</dt>
          <dd>{appointment.scheduledAt}</dd>
        </div>
        <div>
          <dt>状態</dt>
          <dd>{appointment.kind}</dd>
        </div>
      </dl>
      <div className="clinic-actions" aria-label="予約操作">
        {(Object.keys(actionLabels) as ActionKey[]).map((key) => (
          <ActionButton action={actions[key]} key={key} label={actionLabels[key]} />
        ))}
      </div>
    </section>

    {incidentLab === undefined ? null : <IncidentLabPanel incidentLab={incidentLab} />}

    <NoticeDialog notice={notice} />
  </main>
);

export default ClinicDashboard;
