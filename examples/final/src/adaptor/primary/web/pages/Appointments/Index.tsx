import { Link } from "@inertiajs/react";

import { buttonClassName } from "../../components/Button.js";
import { DataTable } from "../../components/DataTable.js";
import { appointmentPresentation } from "../../components/appointmentPresentation.js";
import { EmptyState } from "../../components/Surface.js";
import { StatusBadge } from "../../components/StatusBadge.js";
import type { SharedPageProps } from "../../pageProps.js";
import type { AppointmentPageView } from "../../routes/appointmentRoutes.js";
import Layout from "../Layout.js";

type Props = SharedPageProps &
  Readonly<{ appointments: readonly AppointmentPageView[] }>;

const veterinarianName = (appointment: AppointmentPageView): string => {
  switch (appointment.kind) {
    case "InExamination":
    case "AwaitingPayment":
    case "Paid":
      return appointment.veterinarianName;
    case "Scheduled":
    case "CheckedIn":
    case "Canceled":
      return "未割当";
    default:
      return appointment satisfies never;
  }
};

export default function AppointmentsIndex({ auth, appointments }: Props) {
  const canBook =
    auth.user?.role === "Admin" || auth.user?.role === "Receptionist";
  return (
    <Layout
      actions={
        canBook ? (
          <Link className={buttonClassName()} href="/appointments/new">
            新しい予約
          </Link>
        ) : undefined
      }
      activeNavigation="appointments"
      title="予約一覧"
      user={auth.user}
    >
      {appointments.length === 0 ? (
        <EmptyState>予約はありません。</EmptyState>
      ) : (
        <DataTable label="予約一覧">
          <thead>
            <tr>
              <th scope="col">予約日時</th>
              <th scope="col">状態</th>
              <th scope="col">飼い主</th>
              <th scope="col">ペット</th>
              <th scope="col">担当獣医師</th>
            </tr>
          </thead>
          <tbody>
            {appointments.map((appointment) => {
              const status = appointmentPresentation(appointment.kind);
              return (
                <tr key={appointment.appointmentId}>
                  <td>
                    <Link href={`/appointments/${appointment.appointmentId}`}>
                      {appointment.scheduledAt}
                    </Link>
                  </td>
                  <td>
                    <StatusBadge tone={status.tone}>
                      {status.label} ({status.canonical})
                    </StatusBadge>
                  </td>
                  <td>{appointment.ownerName}</td>
                  <td>{appointment.petName}</td>
                  <td>{veterinarianName(appointment)}</td>
                </tr>
              );
            })}
          </tbody>
        </DataTable>
      )}
    </Layout>
  );
}
