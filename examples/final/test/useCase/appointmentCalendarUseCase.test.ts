import { okAsync } from "neverthrow";
import { describe, expect, test } from "vitest";

import { Timestamp } from "../../src/domain/aggregate/timestamp.js";
import { BusinessDate } from "../../src/domain/appointment/businessDate.js";
import { AppointmentId } from "../../src/domain/appointment/appointmentId.js";
import { VeterinarianId } from "../../src/domain/appointment/veterinarianId.js";
import { UserId } from "../../src/domain/user/userId.js";
import { ListAppointmentCalendarUseCase } from "../../src/useCase/listAppointmentCalendarUseCase.js";

const actorUserId = UserId.schema.parse("81000000-0000-4000-8000-000000000001");
const veterinarianId = VeterinarianId.schema.parse("81000000-0000-4000-8000-000000000002");
const actor = {
  kind: "Admin" as const,
  userId: actorUserId,
  email: "admin@example.test" as never,
  name: "管理者" as never,
  passwordHash: "hash" as never,
};

describe("BusinessDate", () => {
  test("converts a JST day into a half-open UTC range without DST drift", () => {
    const range = BusinessDate.dayRange(BusinessDate.schema.parse("2026-08-09"));

    expect(range).toEqual({
      startsAt: Timestamp.schema.parse("2026-08-08T15:00:00.000Z"),
      endsAt: Timestamp.schema.parse("2026-08-09T15:00:00.000Z"),
    });
  });

  test("uses Monday through the following Monday for a JST week", () => {
    const range = BusinessDate.weekRange(BusinessDate.schema.parse("2026-08-09"));

    expect(range).toEqual({
      startsAt: Timestamp.schema.parse("2026-08-02T15:00:00.000Z"),
      endsAt: Timestamp.schema.parse("2026-08-09T15:00:00.000Z"),
    });
  });

  test("rejects impossible calendar dates", () => {
    expect(BusinessDate.schema.safeParse("2026-02-29").success).toBe(false);
  });
});

describe("ListAppointmentCalendarUseCase", () => {
  test("keeps canceled appointments hidden by default and filters by veterinarian", async () => {
    const scheduled = {
      appointmentId: AppointmentId.schema.parse("82000000-0000-4000-8000-000000000001"),
      startsAt: Timestamp.schema.parse("2026-08-09T01:00:00.000Z"),
      endsAt: Timestamp.schema.parse("2026-08-09T01:30:00.000Z"),
      durationMinutes: 30 as const,
      petName: "むぎ",
      serviceCode: "GeneralConsultation" as const,
      bookingKind: "Reserved" as const,
      assignedVeterinarianId: veterinarianId,
      assignedVeterinarianName: "佐藤 獣医師",
      appointmentStatus: "Scheduled" as const,
      settlementStatus: "NoPayment" as const,
    };
    const canceled = {
      ...scheduled,
      appointmentId: AppointmentId.schema.parse("82000000-0000-4000-8000-000000000002"),
      appointmentStatus: "Canceled" as const,
    };
    const useCase = ListAppointmentCalendarUseCase.create({
      userResolver: { resolveById: () => okAsync(actor) },
      appointmentCalendarReader: { list: () => okAsync([canceled, scheduled]) },
    });

    const result = await useCase.run({
      actorUserId,
      date: BusinessDate.schema.parse("2026-08-09"),
      view: "week",
      veterinarianId,
      includeCanceled: false,
    });

    expect(result._unsafeUnwrap().appointments).toEqual([scheduled]);
  });
});
