import { Link } from "@inertiajs/react";

import type { SharedPageProps } from "../../pageProps.js";
import type { AppointmentPageView } from "../../routes/appointmentRoutes.js";
import Layout from "../Layout.js";

type Props = SharedPageProps &
  Readonly<{ appointments: readonly AppointmentPageView[] }>;

const veterinarianName = (appointment: AppointmentPageView): string => {
  switch (appointment.kind) {
    case "InExamination":
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
    <Layout title="予約一覧" user={auth.user}>
      {canBook ? <p><Link href="/appointments/new">予約を登録</Link></p> : null}
      {appointments.length === 0 ? (
        <p>予約はありません。</p>
      ) : (
        <table>
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
            {appointments.map((appointment) => (
              <tr key={appointment.appointmentId}>
                <td>
                  <Link href={`/appointments/${appointment.appointmentId}`}>
                    {appointment.scheduledAt}
                  </Link>
                </td>
                <td>{appointment.kind}</td>
                <td>{appointment.ownerName}</td>
                <td>{appointment.petName}</td>
                <td>{veterinarianName(appointment)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Layout>
  );
}
