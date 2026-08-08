import type { UseCaseOk as DashboardView } from "../../../../useCase/getDashboardUseCase.js";
import type { SharedPageProps } from "../pageProps.js";
import Layout from "./Layout.js";

type DashboardProps = SharedPageProps & DashboardView;

export default function Dashboard({
  activeAppointments,
  auth,
  counts,
}: DashboardProps) {
  return (
    <Layout title="ダッシュボード" user={auth.user}>
      <dl className="counts">
        <div><dt>飼い主</dt><dd>{counts.owners}</dd></div>
        <div><dt>ペット</dt><dd>{counts.pets}</dd></div>
        <div><dt>予約</dt><dd>{counts.appointments}</dd></div>
        <div><dt>進行中</dt><dd>{counts.activeAppointments}</dd></div>
      </dl>
      <section>
        <h2>進行中の予約</h2>
        {activeAppointments.length === 0 ? (
          <p>進行中の予約はありません。</p>
        ) : (
          <ul>
            {activeAppointments.map((appointment) => (
              <li key={appointment.appointmentId}>
                {appointment.petName} — {appointment.kind}
              </li>
            ))}
          </ul>
        )}
      </section>
    </Layout>
  );
}
