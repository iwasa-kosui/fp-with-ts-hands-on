import { describe, expect, test } from "vitest";

import {
  createSqliteDatabase,
  migrateDatabase,
} from "../../src/adaptor/secondary/sqlite/db.js";
import { createAppointmentRepository } from "../../src/adaptor/secondary/sqlite/appointmentRepository.js";
import type { Appointment } from "../../src/domain/appointment/appointment.js";
import {
  startExamination,
  startExaminationWithAuditFailure,
} from "../../src/useCase/startExamination.js";

const initialAppointment = {
  appointmentId: "11111111-1111-4111-8111-111111111111",
  petId: "22222222-2222-4222-8222-222222222222",
  petName: "Mugi",
  ownerId: "33333333-3333-4333-8333-333333333333",
  ownerName: "Owner A",
  ownerEmail: "owner@example.test",
  ownerPhone: "090-0000-0000",
  scheduledAt: "2026-08-30T06:30:00.000Z",
  reason: "skin check",
  status: "scheduled",
} as const satisfies Appointment;

const input = {
  appointmentId: initialAppointment.appointmentId,
  veterinarianId: "44444444-4444-4444-8444-444444444444",
};

const createRepository = () => {
  const database = createSqliteDatabase(":memory:");
  migrateDatabase(database);

  return createAppointmentRepository(database);
};

describe("未改善の診察開始use case", () => {
  test("診察開始ごとに異なる監査event IDを直接生成する", () => {
    const repository = createRepository();
    repository.reset(initialAppointment);

    const first = startExamination(repository)(input);
    const second = startExamination(repository)(input);
    const eventIds = repository
      .listAuditLogs()
      .slice(-2)
      .map(({ eventId }) => eventId);

    expect(eventIds[0]).not.toBe(eventIds[1]);
    expect(first.status).toBe("in-examination");
    expect(second.status).toBe("in-examination");
  });

  test("監査追記が失敗しても予約だけ診察中へ保存する", () => {
    const repository = createRepository();
    repository.reset(initialAppointment);

    expect(() => startExaminationWithAuditFailure(repository)(input)).toThrow();
    expect(repository.find(input.appointmentId)?.status).toBe("in-examination");
    expect(repository.listAuditLogs()).toHaveLength(1);
  });

  test("存在しない予約では予約IDを含むErrorをthrowする", () => {
    const repository = createRepository();
    const missingAppointmentId = "55555555-5555-4555-8555-555555555555";

    expect(() =>
      startExamination(repository)({
        ...input,
        appointmentId: missingAppointmentId,
      }),
    ).toThrow(new Error(`Appointment not found: ${missingAppointmentId}`));
  });
});
