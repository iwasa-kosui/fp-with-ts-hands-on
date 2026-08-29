import { Link } from "@inertiajs/react";
import type { AppointmentPageView } from "../routes/appointmentRoutes.js";
import type { DashboardCounts } from "../../../../useCase/getDashboardUseCase.js";
import { DataTable } from "@fp-with-ts/clinic-web";
import { appointmentPresentation } from "../components/appointmentPresentation.js";
import { Card, EmptyState } from "@fp-with-ts/clinic-web";
import { StatusBadge } from "@fp-with-ts/clinic-web";
import type { SharedPageProps } from "../pageProps.js";
import Layout from "./Layout.js";

type DashboardProps = SharedPageProps &
  Readonly<{
    counts: DashboardCounts;
    activeAppointments: readonly Readonly<
      Pick<AppointmentPageView, "appointmentId" | "kind" | "petName" | "scheduledAt">
    >[];
  }>;

export default function Dashboard({
  activeAppointments,
  auth,
  counts,
}: DashboardProps) {
  return (
    <Layout
      activeNavigation="dashboard"
      description="現在の業務状況を確認します。"
      title="ダッシュボード"
      user={auth.user}
    >
      <dl className="metrics-grid">
        <Card><dt>飼い主</dt><dd>{counts.owners}</dd></Card>
        <Card><dt>ペット</dt><dd>{counts.pets}</dd></Card>
        <Card><dt>予約</dt><dd>{counts.appointments}</dd></Card>
        <Card><dt>進行中</dt><dd>{counts.activeAppointments}</dd></Card>
      </dl>
      <Card className="dashboard-queue">
        <section aria-label="進行中の予約">
          <h2>進行中の予約</h2>
          {activeAppointments.length === 0 ? (
            <EmptyState>進行中の予約はありません。</EmptyState>
          ) : (
            <DataTable label="進行中の予約">
              <thead>
                <tr>
                  <th scope="col">予約日時</th>
                  <th scope="col">ペット</th>
                  <th scope="col">状態</th>
                </tr>
              </thead>
              <tbody>
                {activeAppointments.map((appointment) => {
                  const status = appointmentPresentation(appointment.kind);
                  return (
                    <tr key={appointment.appointmentId}>
                      <td>
                        <Link href={`/appointments/${appointment.appointmentId}`}>
                          {appointment.scheduledAt}
                        </Link>
                      </td>
                      <td>{appointment.petName}</td>
                      <td>
                        <StatusBadge tone={status.tone}>
                          {status.label} ({status.canonical})
                        </StatusBadge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </DataTable>
          )}
        </section>
      </Card>
    </Layout>
  );
}
