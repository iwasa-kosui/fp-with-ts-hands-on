import { Link } from "@inertiajs/react";
import type { CSSProperties, ReactElement } from "react";

import { BusinessDate } from "../../../../domain/appointment/businessDate.js";
import type { CalendarView } from "../../../../useCase/listAppointmentCalendarUseCase.js";
import type { AppointmentCalendarItem } from "../../../../useCase/query/appointmentCalendarReader.js";
import { appointmentPresentation, bookingKindPresentation } from "./appointmentPresentation.js";
import {
  layoutAppointmentCards,
  partitionCalendarAppointments,
  calendarMinimumLaneWidthPixels,
  type CalendarCardLayout,
} from "./appointmentCalendarLayout.js";
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
const dateLabel = (date: string): string => new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", weekday: "short", timeZone: "Asia/Tokyo" }).format(new Date(`${date}T12:00:00.000Z`));
const timeRange = (appointment: AppointmentCalendarItem): string => {
  const starts = jstParts(appointment.startsAt);
  const ends = jstParts(appointment.endsAt);
  const endsOnAnotherDay = starts.date !== ends.date;
  return `${time(appointment.startsAt)}〜${endsOnAnotherDay ? `${dateLabel(ends.date)} ` : ""}${time(appointment.endsAt)}`;
};
const columnKeyFor = (view: CalendarView, appointment: AppointmentCalendarItem): string =>
  view === "day" ? appointment.assignedVeterinarianId ?? "unassigned" : jstParts(appointment.startsAt).date;

const Card = ({ layout }: Readonly<{ layout: CalendarCardLayout }>): ReactElement => {
  const { appointment } = layout;
  const status = appointmentPresentation(appointment.appointmentStatus);
  const service = servicePresentation(appointment.serviceCode);
  const veterinarian = appointment.assignedVeterinarianName ?? "担当医未定";
  const settlement = settlementPresentation(appointment.settlementStatus);
  const placement: CSSProperties = {
    top: `${layout.topPixels}px`,
    height: `${Math.max(layout.heightPixels, 1)}px`,
    left: `calc(${layout.lane} * (100% / ${layout.laneCount}))`,
    width: `calc(100% / ${layout.laneCount})`,
  };
  return <Link aria-label={`${timeRange(appointment)}、${appointment.petName}、${service}、${veterinarian}、${status.label}、${settlement}`} className="appointment-calendar__card" href={`/appointments/${appointment.appointmentId}`} style={placement}>
    <span className="appointment-calendar__card-row">{timeRange(appointment)}（{appointment.durationMinutes}分）・{appointment.petName}</span>
    <span className="appointment-calendar__card-row">{service}・{bookingKindPresentation(appointment.bookingKind)}・{veterinarian}</span>
    <span className="appointment-calendar__card-row">{status.label}・{settlement}</span>
  </Link>;
};

const AuxiliaryList = ({ label, appointments, view }: Readonly<{ label: string; appointments: readonly AppointmentCalendarItem[]; view: CalendarView }>): ReactElement | null => appointments.length === 0 ? null : (
  <section className="appointment-calendar__auxiliary" aria-label={label}><h2>{label}</h2><ul>{appointments.map((appointment) => <li key={appointment.appointmentId}><Link href={`/appointments/${appointment.appointmentId}`}>{view === "week" ? `${dateLabel(jstParts(appointment.startsAt).date)} ` : ""}{timeRange(appointment)} {appointment.petName}（{appointment.assignedVeterinarianName ?? "担当医未定"}）</Link></li>)}</ul></section>
);

export default function AppointmentCalendar({ date, view, appointments, veterinarians, selectedVeterinarianId }: Props): ReactElement {
  const businessDate = BusinessDate.schema.parse(date);
  const weekStart = BusinessDate.shift(businessDate, -((new Date(`${businessDate}T12:00:00.000Z`).getUTCDay() + 6) % 7));
  const dates = view === "day" ? [businessDate] : Array.from({ length: 7 }, (_, index) => BusinessDate.shift(weekStart, index));
  const columns = view === "day"
    ? [{ key: "unassigned", label: "担当医未定" }, ...veterinarians
      .filter((vet) => selectedVeterinarianId === null || vet.veterinarianId === selectedVeterinarianId)
      .sort((left, right) => left.name.localeCompare(right.name, "ja"))
      .map((vet) => ({ key: vet.veterinarianId, label: vet.name }))]
    : dates.map((value) => ({ key: value, label: dateLabel(value) }));
  const display = partitionCalendarAppointments({ date, view, appointments });
  const layouts = layoutAppointmentCards({ date, view, appointments: display.main });
  const gridTemplateColumns = `72px ${columns.map((column) => {
    const laneCount = Math.max(1, ...layouts.filter((layout) => layout.columnKey === column.key).map((layout) => layout.laneCount));
    return `${laneCount * calendarMinimumLaneWidthPixels}px`;
  }).join(" ")}`;
  return <>
    <AuxiliaryList label="08:00より前の予約" appointments={display.before} view={view} />
    <section aria-label="予約カレンダー" className="appointment-calendar"><div className="appointment-calendar__scroll"><div className="appointment-calendar__headers" style={{ gridTemplateColumns }}><span>時刻</span>{columns.map((column) => <span key={column.key}>{column.label}</span>)}</div><div className="appointment-calendar__timeline" style={{ gridTemplateColumns }}><div className="appointment-calendar__times">{Array.from({ length: 12 }, (_, index) => <span key={index}>{String(index + 8).padStart(2, "0")}:00</span>)}</div>{columns.map((column) => <div className="appointment-calendar__column" key={column.key}>{layouts.filter((layout) => layout.columnKey === column.key).map((layout) => <Card key={layout.appointment.appointmentId} layout={layout} />)}</div>)}</div></div></section>
    <AuxiliaryList label="20:00以降の予約" appointments={display.after} view={view} />
  </>;
}
