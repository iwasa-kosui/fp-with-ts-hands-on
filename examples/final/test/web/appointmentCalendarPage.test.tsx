import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";

import AppointmentCalendar from "../../src/adaptor/primary/web/components/AppointmentCalendar.js";
import AppointmentsIndex from "../../src/adaptor/primary/web/pages/Appointments/Index.js";
import { AppointmentId } from "../../src/domain/appointment/appointmentId.js";
import { VeterinarianId } from "../../src/domain/appointment/veterinarianId.js";
import { UserId } from "../../src/domain/user/userId.js";

const item = {
  appointmentId: AppointmentId.schema.parse("84000000-0000-4000-8000-000000000001"),
  startsAt: "2026-08-09T01:00:00.000Z" as never,
  endsAt: "2026-08-09T01:30:00.000Z" as never,
  durationMinutes: 30 as const,
  petName: "むぎ",
  serviceCode: "GeneralConsultation" as const,
  assignedVeterinarianId: VeterinarianId.schema.parse("84000000-0000-4000-8000-000000000002"),
  assignedVeterinarianName: "佐藤 獣医師",
  appointmentStatus: "Scheduled" as const,
  settlementStatus: "NoPayment" as const,
  bookingKind: "Reserved" as const,
};

describe("AppointmentCalendar", () => {
  test("renders Japanese card labels and an accessible detail link without PII", () => {
    const html = renderToString(createElement(AppointmentCalendar, {
      date: "2026-08-09", view: "day", appointments: [item],
      veterinarians: [{ veterinarianId: item.assignedVeterinarianId, name: "佐藤 獣医師" }],
      selectedVeterinarianId: null,
    }));

    expect(html).toContain("一般診療");
    expect(html).toContain("予約済み");
    expect(html).toContain("未精算");
    expect(html).toContain("aria-label=\"10:00〜10:30、むぎ、一般診療、佐藤 獣医師、予約済み、未精算\"");
    expect(html).not.toContain("GeneralConsultation");
    expect(html).not.toContain("受付メモ");
  });

  test("keeps each required Japanese appointment field in three compact rows inside the detail link", () => {
    const html = renderToString(createElement(AppointmentCalendar, {
      date: "2026-08-09", view: "day", appointments: [item],
      veterinarians: [{ veterinarianId: item.assignedVeterinarianId, name: "佐藤 獣医師" }],
      selectedVeterinarianId: null,
    }));

    const visibleText = html.replaceAll("<!-- -->", "");
    expect(html).toContain('class="appointment-calendar__card-row"');
    expect((html.match(/appointment-calendar__card-row/g) ?? [])).toHaveLength(3);
    expect(visibleText).toContain("10:00〜10:30（30分）・むぎ");
    expect(visibleText).toContain("一般診療・予約・佐藤 獣医師");
    expect(visibleText).toContain("予約済み・未精算");
  });

  test("orders day columns as unassigned then veterinarian name and keeps out-of-hours appointments in lists", () => {
    const early = { ...item, appointmentId: AppointmentId.schema.parse("84000000-0000-4000-8000-000000000004"), startsAt: "2026-08-08T22:45:00.000Z" as never, endsAt: "2026-08-08T23:15:00.000Z" as never, assignedVeterinarianId: null, assignedVeterinarianName: null };
    const late = { ...item, appointmentId: AppointmentId.schema.parse("84000000-0000-4000-8000-000000000005"), startsAt: "2026-08-09T11:00:00.000Z" as never, endsAt: "2026-08-09T11:30:00.000Z" as never, assignedVeterinarianId: null, assignedVeterinarianName: null };
    const secondVeterinarianId = VeterinarianId.schema.parse("84000000-0000-4000-8000-000000000006");
    const html = renderToString(createElement(AppointmentCalendar, {
      date: "2026-08-09", view: "day", appointments: [early, late, item], selectedVeterinarianId: null,
      veterinarians: [
        { veterinarianId: secondVeterinarianId, name: "山田 獣医師" },
        { veterinarianId: item.assignedVeterinarianId, name: "佐藤 獣医師" },
      ],
    }));

    expect(html.indexOf("担当医未定")).toBeLessThan(html.indexOf("佐藤 獣医師"));
    expect(html.indexOf("佐藤 獣医師")).toBeLessThan(html.indexOf("山田 獣医師"));
    expect(html).toContain("08:00より前の予約");
    expect(html).toContain("20:00以降の予約");
  });

  test("renders every overlapping week card as an independently focusable detail link with its veterinarian", () => {
    const secondVeterinarianId = VeterinarianId.schema.parse("84000000-0000-4000-8000-000000000008");
    const first = { ...item, appointmentId: AppointmentId.schema.parse("84000000-0000-4000-8000-000000000009"), petName: "あお", endsAt: "2026-08-09T01:15:00.000Z" as never, durationMinutes: 15 as const };
    const second = { ...item, appointmentId: AppointmentId.schema.parse("84000000-0000-4000-8000-000000000010"), petName: "いお", durationMinutes: 30 as const, assignedVeterinarianId: secondVeterinarianId, assignedVeterinarianName: "山田 獣医師" };
    const third = { ...item, appointmentId: AppointmentId.schema.parse("84000000-0000-4000-8000-000000000011"), petName: "うお", endsAt: "2026-08-09T01:45:00.000Z" as never, durationMinutes: 45 as const, assignedVeterinarianId: null, assignedVeterinarianName: null };
    const html = renderToString(createElement(AppointmentCalendar, {
      date: "2026-08-09", view: "week", appointments: [first, second, third],
      veterinarians: [{ veterinarianId: item.assignedVeterinarianId, name: "佐藤 獣医師" }, { veterinarianId: secondVeterinarianId, name: "山田 獣医師" }], selectedVeterinarianId: null,
    })).replaceAll("<!-- -->", "");

    expect(html).toContain("8/9(日)");
    expect(html).toContain("佐藤 獣医師");
    expect(html).toContain("山田 獣医師");
    expect(html).toContain("担当医未定");
    expect((html.match(/class="appointment-calendar__card"/g) ?? [])).toHaveLength(3);
    expect((html.match(/href="\/appointments\//g) ?? [])).toHaveLength(3);
    expect(html).toContain("260px 260px 260px 260px 260px 260px 780px");
  });

  test("shows manager-only booking actions at reachable paths without pre-adding the Task 7 board", () => {
    const html = renderToString(createElement(AppointmentsIndex, {
      auth: { user: { userId: UserId.schema.parse("84000000-0000-4000-8000-000000000003"), role: "Receptionist" } },
      errors: {}, flash: {}, date: "2026-08-09", requestedView: "day", appointments: [item],
      veterinarians: [], selectedVeterinarianId: null, includeCanceled: false, today: "2026-08-09",
    }));

    expect(html).toContain("予約カレンダー");
    expect(html).toContain('href="/appointments/new"');
    expect(html).toContain('href="/reception/walk-ins/new"');
    expect(html).not.toContain('href="/reception/board"');
    const veterinarianHtml = renderToString(createElement(AppointmentsIndex, {
      auth: { user: { userId: UserId.schema.parse("84000000-0000-4000-8000-000000000007"), role: "Veterinarian" } },
      errors: {}, flash: {}, date: "2026-08-09", requestedView: "day", appointments: [item],
      veterinarians: [], selectedVeterinarianId: null, includeCanceled: false, today: "2026-08-09",
    }));
    expect(veterinarianHtml).not.toContain("飛び込み受付");
  });

  test("shows the JST day or Monday-to-Sunday range and uses the server-provided today", () => {
    const dayHtml = renderToString(createElement(AppointmentsIndex, {
      auth: { user: null }, errors: {}, flash: {}, date: "2026-08-09", requestedView: "day", appointments: [], veterinarians: [], selectedVeterinarianId: null, includeCanceled: false, today: "2026-08-10",
    }));
    const weekHtml = renderToString(createElement(AppointmentsIndex, {
      auth: { user: null }, errors: {}, flash: {}, date: "2026-08-09", requestedView: "week", appointments: [], veterinarians: [], selectedVeterinarianId: null, includeCanceled: false, today: "2026-08-10",
    }));

    expect(dayHtml).toContain("2026年8月9日（日）");
    expect(dayHtml).toContain('href="/appointments?date=2026-08-10&amp;view=day"');
    expect(weekHtml).toContain("2026年8月3日（月）〜8月9日（日）");
    expect(weekHtml).toContain('aria-current="page"');
  });
});
