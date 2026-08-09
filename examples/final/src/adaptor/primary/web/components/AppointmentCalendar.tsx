import { Link } from "@inertiajs/react";
import type { CSSProperties, ReactElement } from "react";

import { BusinessDate } from "../../../../domain/appointment/businessDate.js";
import type { CalendarView } from "../../../../useCase/listAppointmentCalendarUseCase.js";
import type { AppointmentCalendarItem } from "../../../../useCase/query/appointmentCalendarReader.js";
import { appointmentPresentation } from "./appointmentPresentation.js";
import { servicePresentation } from "./servicePresentation.js";
import { settlementPresentation } from "./settlementPresentation.js";

type Props = Readonly<{
  date: string;
  view: CalendarView;
  appointments: readonly AppointmentCalendarItem[];
  veterinarians: readonly Readonly<{ veterinarianId: string; name: string }>[];
  selectedVeterinarianId: string | null;
}>;

const jstParts = (timestamp: string): Readonly<{ hour: number; minute: number; date: string }> => {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(timestamp));
  const value = (type: Intl.DateTimeFormatPartTypes): string => parts.find((part) => part.type === type)?.value ?? "";
  return { hour: Number(value("hour")), minute: Number(value("minute")), date: `${value("year")}-${value("month")}-${value("day")}` };
};
const time = (timestamp: string): string => {
  const { hour, minute } = jstParts(timestamp);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};
const timeRange = (appointment: AppointmentCalendarItem): string => `${time(appointment.startsAt)}〜${time(appointment.endsAt)}`;
const isMainGridItem = (appointment: AppointmentCalendarItem): boolean => {
  const start = jstParts(appointment.startsAt);
  return start.hour >= 8 && start.hour < 20;
};
const sortByStartThenPet = (appointments: readonly AppointmentCalendarItem[]): readonly AppointmentCalendarItem[] =>
  [...appointments].sort((left, right) => left.startsAt.localeCompare(right.startsAt) || left.petName.localeCompare(right.petName, "ja"));

const AppointmentCard = ({ appointment, column }: Readonly<{ appointment: AppointmentCalendarItem; column: number }>): ReactElement => {
  const start = jstParts(appointment.startsAt);
  const slot = (start.hour - 8) * 4 + start.minute / 15;
  const status = appointmentPresentation(appointment.appointmentStatus);
  const service = servicePresentation(appointment.serviceCode);
  const veterinarian = appointment.assignedVeterinarianName ?? "担当医未定";
  const settlement = settlementPresentation(appointment.settlementStatus);
  const placement: CSSProperties = { gridColumn: column + 2, gridRow: `${slot + 1} / span ${appointment.durationMinutes / 15}` };
  return (
    <Link aria-label={`${timeRange(appointment)}、${appointment.petName}、${service}、${veterinarian}、${status.label}、${settlement}`} className="appointment-calendar__card" href={`/appointments/${appointment.appointmentId}`} style={placement}>
      <strong>{timeRange(appointment)}（{appointment.durationMinutes}分）</strong>
      <span>{appointment.petName}</span><span>{veterinarian}</span><span>{service}</span>
      <span>{appointment.bookingKind === "Reserved" ? "予約" : "飛び込み"}</span>
      <span>{status.label}・{settlement}</span>
    </Link>
  );
};

const AuxiliaryList = ({ label, appointments }: Readonly<{ label: string; appointments: readonly AppointmentCalendarItem[] }>): ReactElement | null => appointments.length === 0 ? null : (
  <section className="appointment-calendar__auxiliary" aria-label={label}><h2>{label}</h2><ul>{sortByStartThenPet(appointments).map((appointment) => <li key={appointment.appointmentId}><Link href={`/appointments/${appointment.appointmentId}`}>{timeRange(appointment)} {appointment.petName}（{appointment.assignedVeterinarianName ?? "担当医未定"}）</Link></li>)}</ul></section>
);

export default function AppointmentCalendar({ date, view, appointments, veterinarians, selectedVeterinarianId }: Props): ReactElement {
  const businessDate = BusinessDate.schema.parse(date);
  const dates = view === "day" ? [businessDate] : Array.from({ length: 7 }, (_, index) => BusinessDate.shift(businessDate, index - ((new Date(`${businessDate}T12:00:00.000Z`).getUTCDay() + 6) % 7)));
  const columns = view === "day"
    ? [{ key: "unassigned", label: "担当医未定" }, ...veterinarians
      .filter((vet) => selectedVeterinarianId === null || vet.veterinarianId === selectedVeterinarianId)
      .sort((left, right) => left.name.localeCompare(right.name, "ja"))
      .map((vet) => ({ key: vet.veterinarianId, label: vet.name }))]
    : dates.map((value) => ({ key: value, label: new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", weekday: "short", timeZone: "Asia/Tokyo" }).format(new Date(`${value}T12:00:00.000Z`)) }));
  const before = appointments.filter((appointment) => !isMainGridItem(appointment));
  const after = before.filter((appointment) => jstParts(appointment.startsAt).hour >= 20);
  const beforeOpen = before.filter((appointment) => jstParts(appointment.startsAt).hour < 8);
  const main = appointments.filter(isMainGridItem);
  const cards = main.map((appointment) => {
    const column = view === "day"
      ? appointment.assignedVeterinarianId === null ? 0 : Math.max(0, columns.findIndex((item) => item.key === appointment.assignedVeterinarianId))
      : Math.max(0, columns.findIndex((item) => item.key === jstParts(appointment.startsAt).date));
    return <AppointmentCard key={appointment.appointmentId} appointment={appointment} column={column} />;
  });
  return <>
    <AuxiliaryList label="08:00より前の予約" appointments={beforeOpen} />
    <section aria-label="予約カレンダー" className="appointment-calendar"><div className="appointment-calendar__scroll"><div className="appointment-calendar__headers" style={{ gridTemplateColumns: `72px repeat(${columns.length}, minmax(180px, 1fr))` }}><span>時刻</span>{columns.map((column) => <span key={column.key}>{column.label}</span>)}</div><div className="appointment-calendar__grid" style={{ gridTemplateColumns: `72px repeat(${columns.length}, minmax(180px, 1fr))` }}><div className="appointment-calendar__times">{Array.from({ length: 12 }, (_, index) => <span key={index}>{String(index + 8).padStart(2, "0")}:00</span>)}</div>{cards}</div></div></section>
    <AuxiliaryList label="20:00以降の予約" appointments={after} />
  </>;
}
