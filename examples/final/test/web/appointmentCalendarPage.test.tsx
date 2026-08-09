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

  test("makes the calendar page the reservation navigation entry while preserving booking and walk-in actions", () => {
    const html = renderToString(createElement(AppointmentsIndex, {
      auth: { user: { userId: UserId.schema.parse("84000000-0000-4000-8000-000000000003"), role: "Receptionist" } },
      errors: {}, flash: {}, date: "2026-08-09", requestedView: "day", appointments: [item],
      veterinarians: [], selectedVeterinarianId: null, includeCanceled: false,
    }));

    expect(html).toContain("予約カレンダー");
    expect(html).toContain('href="/appointments/new"');
    expect(html).toContain('href="/reception/walk-in"');
  });
});
