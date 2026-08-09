import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

import {
  layoutAppointmentCards,
  partitionCalendarAppointments,
} from "../../src/adaptor/primary/web/components/appointmentCalendarLayout.js";
import { AppointmentId } from "../../src/domain/appointment/appointmentId.js";
import { VeterinarianId } from "../../src/domain/appointment/veterinarianId.js";
import type { AppointmentCalendarItem } from "../../src/useCase/query/appointmentCalendarReader.js";

const veterinarianId = VeterinarianId.schema.parse("88000000-0000-4000-8000-000000000001");
const appointment = (
  id: string,
  startsAt: string,
  endsAt: string,
  petName: string,
  assignedVeterinarianId: VeterinarianId | null = veterinarianId,
  durationMinutes: 15 | 30 | 45 | 60 = 30,
): AppointmentCalendarItem => ({
  appointmentId: AppointmentId.schema.parse(id),
  startsAt: startsAt as never,
  endsAt: endsAt as never,
  durationMinutes,
  petName,
  serviceCode: "GeneralConsultation",
  bookingKind: "Reserved",
  assignedVeterinarianId,
  assignedVeterinarianName: assignedVeterinarianId === null ? null : "佐藤 獣医師",
  appointmentStatus: "Scheduled",
  settlementStatus: "NoPayment",
});

describe("calendar display partition", () => {
  test("keeps only the requested JST day in day view while week view keeps the whole week", () => {
    const previous = appointment("88000000-0000-4000-8000-000000000010", "2026-08-08T01:00:00.000Z", "2026-08-08T01:30:00.000Z", "前日main");
    const targetMain = appointment("88000000-0000-4000-8000-000000000011", "2026-08-09T01:00:00.000Z", "2026-08-09T01:30:00.000Z", "対象main");
    const targetBefore = appointment("88000000-0000-4000-8000-000000000012", "2026-08-08T22:59:00.000Z", "2026-08-08T23:29:00.000Z", "対象before");
    const targetAfter = appointment("88000000-0000-4000-8000-000000000013", "2026-08-09T11:00:00.000Z", "2026-08-09T11:30:00.000Z", "対象after");
    const next = appointment("88000000-0000-4000-8000-000000000014", "2026-08-10T01:00:00.000Z", "2026-08-10T01:30:00.000Z", "翌日main");
    const appointments = [previous, targetMain, targetBefore, targetAfter, next];

    const day = partitionCalendarAppointments({ date: "2026-08-09", view: "day", appointments });
    const week = partitionCalendarAppointments({ date: "2026-08-09", view: "week", appointments });

    expect(day.main.map((item) => item.appointmentId)).toEqual([targetMain.appointmentId]);
    expect(day.before.map((item) => item.appointmentId)).toEqual([targetBefore.appointmentId]);
    expect(day.after.map((item) => item.appointmentId)).toEqual([targetAfter.appointmentId]);
    expect(week.visible.map((item) => item.appointmentId)).toEqual(appointments.map((item) => item.appointmentId));
  });
});

describe("calendar timeline layout", () => {
  test("uses minute offsets and clips only the part that exceeds the 08:00–20:00 main timeline", () => {
    const at0759 = appointment("88000000-0000-4000-8000-000000000020", "2026-08-08T22:59:00.000Z", "2026-08-08T23:29:00.000Z", "07:59");
    const at0800 = appointment("88000000-0000-4000-8000-000000000021", "2026-08-08T23:00:00.000Z", "2026-08-08T23:15:00.000Z", "08:00", veterinarianId, 15);
    const at0915 = appointment("88000000-0000-4000-8000-000000000025", "2026-08-09T00:15:00.000Z", "2026-08-09T01:00:00.000Z", "09:15", veterinarianId, 45);
    const at1010 = appointment("88000000-0000-4000-8000-000000000022", "2026-08-09T01:10:00.000Z", "2026-08-09T01:40:00.000Z", "10:10");
    const at1945 = appointment("88000000-0000-4000-8000-000000000023", "2026-08-09T10:45:00.000Z", "2026-08-09T11:45:00.000Z", "19:45", veterinarianId, 60);
    const at2000 = appointment("88000000-0000-4000-8000-000000000024", "2026-08-09T11:00:00.000Z", "2026-08-09T11:15:00.000Z", "20:00");

    const display = partitionCalendarAppointments({ date: "2026-08-09", view: "day", appointments: [at0759, at0800, at0915, at1010, at1945, at2000] });
    const layout = layoutAppointmentCards({ date: "2026-08-09", view: "day", appointments: display.main });

    expect(display.before).toEqual([at0759]);
    expect(display.after).toEqual([at2000]);
    expect(layout.map(({ appointment: item, topMinutes, heightMinutes, topPixels, heightPixels }) => ({ id: item.appointmentId, topMinutes, heightMinutes, topPixels, heightPixels }))).toEqual([
      { id: at0800.appointmentId, topMinutes: 0, heightMinutes: 15, topPixels: 0, heightPixels: 60 },
      { id: at0915.appointmentId, topMinutes: 75, heightMinutes: 45, topPixels: 300, heightPixels: 180 },
      { id: at1010.appointmentId, topMinutes: 130, heightMinutes: 30, topPixels: 520, heightPixels: 120 },
      { id: at1945.appointmentId, topMinutes: 705, heightMinutes: 15, topPixels: 2820, heightPixels: 60 },
    ]);
  });

  test("assigns deterministic lanes for same-time and partially overlapping cards in a week date column", () => {
    const komugi = appointment("88000000-0000-4000-8000-000000000030", "2026-08-09T01:00:00.000Z", "2026-08-09T01:30:00.000Z", "こむぎ", null);
    const mugi = appointment("88000000-0000-4000-8000-000000000031", "2026-08-09T01:00:00.000Z", "2026-08-09T01:45:00.000Z", "むぎ", veterinarianId);
    const kohaku = appointment("88000000-0000-4000-8000-000000000032", "2026-08-09T01:20:00.000Z", "2026-08-09T01:50:00.000Z", "こはく", veterinarianId);

    const layout = layoutAppointmentCards({ date: "2026-08-09", view: "week", appointments: [mugi, kohaku, komugi] });

    expect(layout.map(({ appointment: item, lane, laneCount }) => ({ petName: item.petName, lane, laneCount }))).toEqual([
      { petName: "こむぎ", lane: 0, laneCount: 3 },
      { petName: "むぎ", lane: 1, laneCount: 3 },
      { petName: "こはく", lane: 2, laneCount: 3 },
    ]);
  });

  test("uses a four-pixel minute scale so every 15-minute card has a 60px in-box layout", () => {
    const short = appointment("88000000-0000-4000-8000-000000000040", "2026-08-09T01:00:00.000Z", "2026-08-09T01:15:00.000Z", "短時間", veterinarianId, 15);
    const [layout] = layoutAppointmentCards({ date: "2026-08-09", view: "day", appointments: [short] });

    expect(layout?.heightPixels).toBe(60);
  });

  test("keeps continuous short appointments, three lanes, partial overlaps, and the 20:00 clamp as separate card boxes", () => {
    const first = appointment("88000000-0000-4000-8000-000000000041", "2026-08-09T01:00:00.000Z", "2026-08-09T01:15:00.000Z", "あお", veterinarianId, 15);
    const second = appointment("88000000-0000-4000-8000-000000000042", "2026-08-09T01:15:00.000Z", "2026-08-09T01:30:00.000Z", "いお", veterinarianId, 15);
    const third = appointment("88000000-0000-4000-8000-000000000043", "2026-08-09T01:30:00.000Z", "2026-08-09T01:45:00.000Z", "うお", veterinarianId, 15);
    const overlapA = appointment("88000000-0000-4000-8000-000000000044", "2026-08-09T02:00:00.000Z", "2026-08-09T02:30:00.000Z", "あさ", veterinarianId, 30);
    const overlapB = appointment("88000000-0000-4000-8000-000000000045", "2026-08-09T02:00:00.000Z", "2026-08-09T02:45:00.000Z", "いさ", veterinarianId, 45);
    const overlapC = appointment("88000000-0000-4000-8000-000000000046", "2026-08-09T02:10:00.000Z", "2026-08-09T03:10:00.000Z", "うさ", veterinarianId, 60);
    const closing = appointment("88000000-0000-4000-8000-000000000047", "2026-08-09T10:45:00.000Z", "2026-08-09T11:45:00.000Z", "終業", veterinarianId, 60);

    const layout = layoutAppointmentCards({ date: "2026-08-09", view: "day", appointments: [first, second, third, overlapC, overlapB, overlapA, closing] });
    const byPet = new Map(layout.map((item) => [item.appointment.petName, item]));
    expect(["あお", "いお", "うお"].map((petName) => byPet.get(petName)).map((item) => [item?.topPixels, item?.heightPixels])).toEqual([[480, 60], [540, 60], [600, 60]]);
    expect(["あさ", "いさ", "うさ"].map((petName) => byPet.get(petName)?.lane)).toEqual([0, 1, 2]);
    expect(["あさ", "いさ", "うさ"].map((petName) => byPet.get(petName)?.laneCount)).toEqual([3, 3, 3]);
    expect(byPet.get("終業")).toMatchObject({ topPixels: 2820, heightPixels: 60 });
  });

  test("keeps compact card contents inside the clickable box and provides a practical lane width through the calendar scroll area", () => {
    const css = readFileSync(new URL("../../src/adaptor/primary/web/styles.css", import.meta.url), "utf8");

    expect(css).toMatch(/\.appointment-calendar\s*\{[^}]*max-width:\s*100%/s);
    expect(css).toMatch(/\.appointment-calendar__scroll\s*\{[^}]*overflow:\s*auto/s);
    expect(css).toMatch(/\.appointment-calendar__card\s*\{[^}]*overflow:\s*hidden/s);
    expect(css).not.toMatch(/\.appointment-calendar__card\s*\{[^}]*overflow:\s*visible/s);
    expect(css).toMatch(/\.appointment-calendar__card-row\s*\{[^}]*white-space:\s*nowrap/s);
  });
});
