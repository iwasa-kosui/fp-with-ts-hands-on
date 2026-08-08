import { Link } from "@inertiajs/react";
import type { AppointmentView } from "../../../../useCase/listAppointmentsUseCase.js";
import type { DashboardCounts } from "../../../../useCase/getDashboardUseCase.js";
import type { SharedPageProps } from "../pageProps.js";
import Layout from "./Layout.js";

type DashboardProps = SharedPageProps &
  Readonly<{
    counts: DashboardCounts;
    activeAppointments: readonly Readonly<
      Pick<AppointmentView, "appointmentId" | "kind" | "petName" | "scheduledAt">
    >[];
  }>;

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
                <Link href={`/appointments/${appointment.appointmentId}`}>
                  {appointment.petName} — {appointment.kind}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Layout>
  );
}
