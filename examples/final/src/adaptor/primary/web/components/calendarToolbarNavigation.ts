import type { CalendarView } from "../../../../useCase/listAppointmentCalendarUseCase.js";

export type CalendarQueryInput = Readonly<{
  date: string;
  view: CalendarView;
  veterinarianId: string | null;
  includeCanceled: boolean;
}>;

export const calendarQuery = ({ date, view, veterinarianId, includeCanceled }: CalendarQueryInput): string => {
  const params = new URLSearchParams({ date, view });
  if (veterinarianId !== null) params.set("veterinarianId", veterinarianId);
  if (includeCanceled) params.set("canceled", "1");
  return `/appointments?${params.toString()}`;
};

export type CalendarViewNormalization = Readonly<{
  requestedView: CalendarView | null;
  date: string;
  veterinarianId: string | null;
  includeCanceled: boolean;
  isCompactViewport: () => boolean;
  navigate: (href: string, options: Readonly<{ replace: boolean }>) => void;
}>;

export const normalizeCalendarView = (input: CalendarViewNormalization): void => {
  if (input.requestedView !== null) return;
  const view: CalendarView = input.isCompactViewport() ? "day" : "week";
  input.navigate(calendarQuery({
    date: input.date,
    view,
    veterinarianId: input.veterinarianId,
    includeCanceled: input.includeCanceled,
  }), { replace: true });
};
