import { Link } from "@inertiajs/react";

import { buttonClassName } from "../../components/Button.js";
import AppointmentCalendar from "../../components/AppointmentCalendar.js";
import { CalendarToolbar } from "../../components/CalendarToolbar.js";
import type { SharedPageProps } from "../../pageProps.js";
import type { CalendarView } from "../../../../../useCase/listAppointmentCalendarUseCase.js";
import type { AppointmentCalendarItem } from "../../../../../useCase/query/appointmentCalendarReader.js";
import type { AppointmentPageView } from "../../routes/appointmentRoutes.js";
import Layout from "../Layout.js";

type Props = SharedPageProps &
  Readonly<{
    date?: string;
    requestedView?: CalendarView | null;
    appointments: readonly AppointmentCalendarItem[] | readonly AppointmentPageView[];
    veterinarians?: readonly Readonly<{ veterinarianId: string; name: string }>[];
    selectedVeterinarianId?: string | null;
    includeCanceled?: boolean;
  }>;

const toCalendarItem = (appointment: AppointmentCalendarItem | AppointmentPageView): AppointmentCalendarItem =>
  "startsAt" in appointment
    ? appointment
    : {
      appointmentId: appointment.appointmentId,
      startsAt: appointment.scheduledAt,
      endsAt: appointment.scheduledEndsAt,
      durationMinutes: appointment.durationMinutes,
      petName: appointment.petName,
      serviceCode: appointment.serviceCode,
      bookingKind: appointment.bookingKind,
      assignedVeterinarianId: appointment.assignedVeterinarianId,
      assignedVeterinarianName: appointment.assignedVeterinarianName,
      appointmentStatus: appointment.kind,
      settlementStatus: appointment.settlement.kind,
    };

export default function AppointmentsIndex({
  auth, date = "2026-08-09", requestedView = "week", appointments, veterinarians = [], selectedVeterinarianId = null, includeCanceled = false,
}: Props) {
  const canBook =
    auth.user?.role === "Admin" || auth.user?.role === "Receptionist";
  const view = requestedView ?? "week";
  const calendarAppointments = appointments.map(toCalendarItem);
  return (
    <Layout
      actions={
        canBook ? (
          <><Link className={buttonClassName()} href="/appointments/new">新しい予約</Link><Link className={buttonClassName("secondary")} href="/reception/walk-in">飛び込み受付</Link></>
        ) : undefined
      }
      activeNavigation="appointments"
      title="予約カレンダー"
      user={auth.user}
    >
      <CalendarToolbar date={date} requestedView={requestedView} selectedVeterinarianId={selectedVeterinarianId} includeCanceled={includeCanceled} veterinarians={veterinarians} />
      <AppointmentCalendar date={date} view={view} appointments={calendarAppointments} veterinarians={veterinarians} selectedVeterinarianId={selectedVeterinarianId} />
    </Layout>
  );
}
