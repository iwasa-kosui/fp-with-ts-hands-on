import { Link, router } from "@inertiajs/react";
import { useEffect, type ReactElement } from "react";

import { BusinessDate } from "../../../../domain/appointment/businessDate.js";
import { Timestamp } from "../../../../domain/aggregate/timestamp.js";
import type { CalendarView } from "../../../../useCase/listAppointmentCalendarUseCase.js";
import { buttonClassName } from "./Button.js";

type Props = Readonly<{
  date: string;
  requestedView: CalendarView | null;
  selectedVeterinarianId: string | null;
  includeCanceled: boolean;
  veterinarians: readonly Readonly<{ veterinarianId: string; name: string }>[];
}>;

const query = (date: string, view: CalendarView, veterinarianId: string | null, includeCanceled: boolean): string => {
  const params = new URLSearchParams({ date, view });
  if (veterinarianId !== null) params.set("veterinarianId", veterinarianId);
  if (includeCanceled) params.set("canceled", "1");
  return `/appointments?${params.toString()}`;
};

export const CalendarToolbar = ({
  date, requestedView, selectedVeterinarianId, includeCanceled, veterinarians,
}: Props): ReactElement => {
  useEffect(() => {
    if (requestedView === null) {
      const defaultView: CalendarView = window.matchMedia("(max-width: 767px)").matches ? "day" : "week";
      router.get(query(date, defaultView, selectedVeterinarianId, includeCanceled), {}, { replace: true });
    }
  }, [date, includeCanceled, requestedView, selectedVeterinarianId]);

  const view = requestedView ?? "week";
  const businessDate = BusinessDate.schema.parse(date);
  const previous = BusinessDate.shift(businessDate, view === "day" ? -1 : -7);
  const next = BusinessDate.shift(businessDate, view === "day" ? 1 : 7);
  const today = BusinessDate.fromTimestamp(Timestamp.schema.parse(new Date().toISOString()));

  return (
    <section aria-label="カレンダー操作" className="calendar-toolbar">
      <div className="calendar-toolbar__navigation" role="group" aria-label="日付操作">
        <Link className={buttonClassName("secondary")} href={query(previous, view, selectedVeterinarianId, includeCanceled)}>前へ</Link>
        <Link className={buttonClassName("secondary")} href={query(today, view, selectedVeterinarianId, includeCanceled)}>今日</Link>
        <Link className={buttonClassName("secondary")} href={query(next, view, selectedVeterinarianId, includeCanceled)}>次へ</Link>
      </div>
      <div className="calendar-toolbar__controls">
        <span className="calendar-toolbar__view" aria-label="表示単位">
          <Link aria-current={view === "day" ? "page" : undefined} className={buttonClassName(view === "day" ? "primary" : "secondary")} href={query(date, "day", selectedVeterinarianId, includeCanceled)}>日</Link>
          <Link aria-current={view === "week" ? "page" : undefined} className={buttonClassName(view === "week" ? "primary" : "secondary")} href={query(date, "week", selectedVeterinarianId, includeCanceled)}>週</Link>
        </span>
        <label>
          担当獣医師
          <select aria-label="担当獣医師で絞り込む" defaultValue={selectedVeterinarianId ?? ""} onChange={(event) => router.get(query(date, view, event.currentTarget.value || null, includeCanceled))}>
            <option value="">すべて</option>
            {veterinarians.map((veterinarian) => <option key={veterinarian.veterinarianId} value={veterinarian.veterinarianId}>{veterinarian.name}</option>)}
          </select>
        </label>
        <Link className={buttonClassName("ghost")} href={query(date, view, selectedVeterinarianId, !includeCanceled)}>
          {includeCanceled ? "キャンセルを隠す" : "キャンセルを表示"}
        </Link>
      </div>
    </section>
  );
};
