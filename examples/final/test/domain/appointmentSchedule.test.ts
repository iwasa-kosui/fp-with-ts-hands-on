import { describe, expect, test } from "vitest";

import { Timestamp } from "../../src/domain/aggregate/timestamp.js";
import {
  AppointmentDuration,
} from "../../src/domain/appointment/appointmentDuration.js";
import {
  AppointmentSchedule,
  type AppointmentSchedule as AppointmentScheduleValue,
} from "../../src/domain/appointment/appointmentSchedule.js";
import { AppointmentVersion } from "../../src/domain/appointment/appointmentVersion.js";
import { BookingKind } from "../../src/domain/appointment/bookingKind.js";
import { ReceptionNote } from "../../src/domain/appointment/receptionNote.js";
import { ServiceCode, ServiceMenu } from "../../src/domain/appointment/serviceCode.js";
import { SettlementAdjustmentAmount } from "../../src/domain/appointment/settlementAdjustmentAmount.js";

const schedule = (startsAt: string, durationMinutes: 15 | 30 | 45 | 60) =>
  ({
    startsAt: Timestamp.schema.parse(startsAt),
    durationMinutes: AppointmentDuration.schema.parse(durationMinutes),
  }) as const satisfies AppointmentScheduleValue;

describe("appointment schedule", () => {
  test("provides the default duration configured for each service menu", () => {
    expect(ServiceMenu.defaultDuration("GeneralConsultation")).toBe(30);
    expect(ServiceMenu.defaultDuration("FollowUpVisit")).toBe(15);
    expect(ServiceMenu.defaultDuration("Vaccination")).toBe(15);
    expect(ServiceMenu.defaultDuration("ExaminationOrProcedure")).toBe(60);
  });

  test("treats a schedule end and the next schedule start as non-overlapping", () => {
    expect(
      AppointmentSchedule.overlaps(
        schedule("2026-08-09T01:00:00.000Z", 30),
        schedule("2026-08-09T01:30:00.000Z", 30),
      ),
    ).toBe(false);
  });

  test("calculates the schedule end from its start and configured duration", () => {
    expect(
      AppointmentSchedule.endsAt(schedule("2026-08-09T10:45:00.000Z", 60)),
    ).toBe("2026-08-09T11:45:00.000Z");
  });

  test("detects schedules whose half-open time ranges intersect", () => {
    expect(
      AppointmentSchedule.overlaps(
        schedule("2026-08-09T01:00:00.000Z", 30),
        schedule("2026-08-09T01:29:00.000Z", 15),
      ),
    ).toBe(true);
  });

  test("accepts only the configured duration, version, and settlement adjustment values", () => {
    for (const duration of [15, 30, 45, 60]) {
      expect(AppointmentDuration.parse(duration).isOk()).toBe(true);
    }
    for (const duration of [0, 20, 75]) {
      expect(AppointmentDuration.parse(duration).isErr()).toBe(true);
    }

    expect(AppointmentVersion.parse(1).isOk()).toBe(true);
    expect(AppointmentVersion.parse(0).isErr()).toBe(true);
    expect(AppointmentVersion.parse(1.5).isErr()).toBe(true);
    expect(SettlementAdjustmentAmount.parse(0).isOk()).toBe(true);
    expect(SettlementAdjustmentAmount.parse(-1).isErr()).toBe(true);
    expect(SettlementAdjustmentAmount.parse(1.5).isErr()).toBe(true);
  });

  test("validates service and booking codes at the domain boundary", () => {
    expect(ServiceCode.parse("Vaccination").isOk()).toBe(true);
    expect(ServiceCode.parse("Surgery").isErr()).toBe(true);
    expect(BookingKind.parse("Reserved").isOk()).toBe(true);
    expect(BookingKind.parse("Urgent").isErr()).toBe(true);
  });

  test("trims and redacts a non-empty reception note", () => {
    const note = ReceptionNote.schema.parse("  keep the pet calm  ");

    expect(note.unwrap()).toBe("keep the pet calm");
    expect(JSON.stringify(note)).toBe('"[REDACTED]"');
    expect(ReceptionNote.parse("   ").isErr()).toBe(true);
  });

  test("accepts a 1000-character reception note and rejects 1001 characters", () => {
    expect(ReceptionNote.parse("a".repeat(1000)).isOk()).toBe(true);
    expect(ReceptionNote.parse("a".repeat(1001)).isErr()).toBe(true);
  });
});
