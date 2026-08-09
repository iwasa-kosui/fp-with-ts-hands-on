import { Link, router } from "@inertiajs/react";
import { useEffect, type ReactElement } from "react";

import { BusinessDate } from "../../../../domain/appointment/businessDate.js";
import type { CalendarView } from "../../../../useCase/listAppointmentCalendarUseCase.js";
import { buttonClassName } from "./Button.js";
import { calendarQuery, normalizeCalendarView } from "./calendarToolbarNavigation.js";

type Props = Readonly<{
  date: string;
  today: string;
  requestedView: CalendarView | null;
  selectedVeterinarianId: string | null;
  includeCanceled: boolean;
  veterinarians: readonly Readonly<{ veterinarianId: string; name: string }>[];
}>;

const weekdays = ["日", "月", "火", "水", "木", "金", "土"] as const;
const label = (date: string, includeYear: boolean): string => {
  const instant = new Date(`${date}T12:00:00.000Z`);
  const year = instant.getUTCFullYear();
  const month = instant.getUTCMonth() + 1;
  const day = instant.getUTCDate();
  const weekday = weekdays[instant.getUTCDay()];
  return `${includeYear ? `${year}年` : ""}${month}月${day}日（${weekday}）`;
};

export const CalendarToolbar = ({
  date, today, requestedView, selectedVeterinarianId, includeCanceled, veterinarians,
}: Props): ReactElement => {
  useEffect(() => {
    normalizeCalendarView({
      requestedView,
      date,
      veterinarianId: selectedVeterinarianId,
      includeCanceled,
      isCompactViewport: () => window.matchMedia("(max-width: 767px)").matches,
      navigate: (href, options) => router.get(href, {}, options),
    });
  }, [date, includeCanceled, requestedView, selectedVeterinarianId]);

  const view = requestedView ?? "week";
  const businessDate = BusinessDate.schema.parse(date);
  const previous = BusinessDate.shift(businessDate, view === "day" ? -1 : -7);
  const next = BusinessDate.shift(businessDate, view === "day" ? 1 : 7);
  const weekStart = BusinessDate.shift(businessDate, -((new Date(`${businessDate}T12:00:00.000Z`).getUTCDay() + 6) % 7));
  const weekEnd = BusinessDate.shift(weekStart, 6);
  const currentRange = view === "day" ? label(date, true) : `${label(weekStart, true)}〜${label(weekEnd, false)}`;

  return (
    <section aria-label="カレンダー操作" className="calendar-toolbar">
      <p className="calendar-toolbar__current-date" aria-live="polite">{currentRange}</p>
      <div className="calendar-toolbar__navigation" role="group" aria-label="日付操作">
        <Link className={buttonClassName("secondary")} href={calendarQuery({ date: previous, view, veterinarianId: selectedVeterinarianId, includeCanceled })}>前へ</Link>
        <Link className={buttonClassName("secondary")} href={calendarQuery({ date: today, view, veterinarianId: selectedVeterinarianId, includeCanceled })}>今日</Link>
        <Link className={buttonClassName("secondary")} href={calendarQuery({ date: next, view, veterinarianId: selectedVeterinarianId, includeCanceled })}>次へ</Link>
      </div>
      <div className="calendar-toolbar__controls">
        <span className="calendar-toolbar__view" aria-label="表示単位">
          <Link aria-current={view === "day" ? "page" : undefined} className={buttonClassName(view === "day" ? "primary" : "secondary")} href={calendarQuery({ date, view: "day", veterinarianId: selectedVeterinarianId, includeCanceled })}>日</Link>
          <Link aria-current={view === "week" ? "page" : undefined} className={buttonClassName(view === "week" ? "primary" : "secondary")} href={calendarQuery({ date, view: "week", veterinarianId: selectedVeterinarianId, includeCanceled })}>週</Link>
        </span>
        <label>
          担当獣医師
          <select aria-label="担当獣医師で絞り込む" defaultValue={selectedVeterinarianId ?? ""} onChange={(event) => router.get(calendarQuery({ date, view, veterinarianId: event.currentTarget.value || null, includeCanceled }))}>
            <option value="">すべて</option>
            {veterinarians.map((veterinarian) => <option key={veterinarian.veterinarianId} value={veterinarian.veterinarianId}>{veterinarian.name}</option>)}
          </select>
        </label>
        <Link className={buttonClassName("ghost")} href={calendarQuery({ date, view, veterinarianId: selectedVeterinarianId, includeCanceled: !includeCanceled })}>
          {includeCanceled ? "キャンセルを隠す" : "キャンセルを表示"}
        </Link>
      </div>
    </section>
  );
};
