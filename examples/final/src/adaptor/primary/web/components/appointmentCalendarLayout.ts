import type { CalendarView } from "../../../../useCase/listAppointmentCalendarUseCase.js";
import type { AppointmentCalendarItem } from "../../../../useCase/query/appointmentCalendarReader.js";

const mainStartsAtMinute = 8 * 60;
const mainEndsAtMinute = 20 * 60;
export const calendarPixelsPerMinute = 4;
export const calendarMinimumLaneWidthPixels = 260;
export const calendarTimelineHeightPixels = (mainEndsAtMinute - mainStartsAtMinute) * calendarPixelsPerMinute;

type JstDateTime = Readonly<{ date: string; minuteOfDay: number }>;

const jstDateTime = (timestamp: string): JstDateTime => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(timestamp));
  const value = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? "";
  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    minuteOfDay: Number(value("hour")) * 60 + Number(value("minute")),
  };
};

const sortByStartThenPet = (
  appointments: readonly AppointmentCalendarItem[],
): readonly AppointmentCalendarItem[] =>
  [...appointments].sort((left, right) =>
    left.startsAt.localeCompare(right.startsAt) || left.petName.localeCompare(right.petName, "ja"),
  );

export type CalendarDisplay = Readonly<{
  visible: readonly AppointmentCalendarItem[];
  before: readonly AppointmentCalendarItem[];
  main: readonly AppointmentCalendarItem[];
  after: readonly AppointmentCalendarItem[];
}>;

export const partitionCalendarAppointments = (input: Readonly<{
  date: string;
  view: CalendarView;
  appointments: readonly AppointmentCalendarItem[];
}>): CalendarDisplay => {
  const visible = input.view === "day"
    ? input.appointments.filter((appointment) => jstDateTime(appointment.startsAt).date === input.date)
    : input.appointments;
  const before = visible.filter((appointment) => jstDateTime(appointment.startsAt).minuteOfDay < mainStartsAtMinute);
  const after = visible.filter((appointment) => jstDateTime(appointment.startsAt).minuteOfDay >= mainEndsAtMinute);
  const main = visible.filter((appointment) => {
    const minuteOfDay = jstDateTime(appointment.startsAt).minuteOfDay;
    return minuteOfDay >= mainStartsAtMinute && minuteOfDay < mainEndsAtMinute;
  });
  return { visible, before: sortByStartThenPet(before), main: sortByStartThenPet(main), after: sortByStartThenPet(after) };
};

export type CalendarCardLayout = Readonly<{
  appointment: AppointmentCalendarItem;
  columnKey: string;
  lane: number;
  laneCount: number;
  topMinutes: number;
  heightMinutes: number;
  topPixels: number;
  heightPixels: number;
}>;

const columnKey = (view: CalendarView, appointment: AppointmentCalendarItem): string =>
  view === "day"
    ? appointment.assignedVeterinarianId ?? "unassigned"
    : jstDateTime(appointment.startsAt).date;

const timelineEnd = (appointment: AppointmentCalendarItem): number => {
  const start = jstDateTime(appointment.startsAt);
  const end = jstDateTime(appointment.endsAt);
  return start.date === end.date ? end.minuteOfDay : mainEndsAtMinute;
};

const withLanes = (
  view: CalendarView,
  appointments: readonly AppointmentCalendarItem[],
): readonly CalendarCardLayout[] => {
  const groups = new Map<string, AppointmentCalendarItem[]>();
  for (const appointment of sortByStartThenPet(appointments)) {
    const key = columnKey(view, appointment);
    groups.set(key, [...(groups.get(key) ?? []), appointment]);
  }
  return [...groups.entries()].flatMap(([key, columnAppointments]) => {
    const components: AppointmentCalendarItem[][] = [];
    let component: AppointmentCalendarItem[] = [];
    let componentEnd = Number.NEGATIVE_INFINITY;
    for (const appointment of columnAppointments) {
      const start = Date.parse(appointment.startsAt);
      const end = Date.parse(appointment.endsAt);
      if (component.length > 0 && start >= componentEnd) {
        components.push(component);
        component = [];
        componentEnd = Number.NEGATIVE_INFINITY;
      }
      component = [...component, appointment];
      componentEnd = Math.max(componentEnd, end);
    }
    if (component.length > 0) components.push(component);
    return components.flatMap((items) => {
      const laneEnds: number[] = [];
      const assigned = items.map((appointment) => {
        const start = Date.parse(appointment.startsAt);
        const lane = laneEnds.findIndex((end) => end <= start);
        const nextLane = lane === -1 ? laneEnds.length : lane;
        laneEnds[nextLane] = Date.parse(appointment.endsAt);
        const startMinute = jstDateTime(appointment.startsAt).minuteOfDay;
        const endMinute = timelineEnd(appointment);
        return {
          appointment,
          columnKey: key,
          lane: nextLane,
          laneCount: 0,
          topMinutes: Math.max(startMinute, mainStartsAtMinute) - mainStartsAtMinute,
          heightMinutes: Math.max(0, Math.min(endMinute, mainEndsAtMinute) - Math.max(startMinute, mainStartsAtMinute)),
          topPixels: (Math.max(startMinute, mainStartsAtMinute) - mainStartsAtMinute) * calendarPixelsPerMinute,
          heightPixels: Math.max(0, Math.min(endMinute, mainEndsAtMinute) - Math.max(startMinute, mainStartsAtMinute)) * calendarPixelsPerMinute,
        };
      });
      return assigned.map((item) => ({ ...item, laneCount: laneEnds.length }));
    });
  });
};

export const layoutAppointmentCards = (input: Readonly<{
  date: string;
  view: CalendarView;
  appointments: readonly AppointmentCalendarItem[];
}>): readonly CalendarCardLayout[] =>
  withLanes(input.view, partitionCalendarAppointments(input).main);
