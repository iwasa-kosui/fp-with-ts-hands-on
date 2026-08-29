import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

import {
  createSqliteDatabase,
  migrateDatabase,
} from "../../src/adaptor/secondary/sqlite/db.js";
import { appointmentsTable } from "../../src/adaptor/secondary/sqlite/schema.js";
import {
  updateStatus,
  type Appointment,
} from "../../src/domain/appointment/appointment.js";
import { createAppointmentRepository } from "../../src/adaptor/secondary/sqlite/appointmentRepository.js";

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

const createRepository = () => {
  const database = createSqliteDatabase(":memory:");
  migrateDatabase(database);

  return { database, repository: createAppointmentRepository(database) };
};

describe("未改善SQLite予約repository", () => {
  test("予約を更新しても監査payloadに飼い主の連絡先を残してしまう", () => {
    const { repository } = createRepository();

    repository.reset(initialAppointment);
    const updated = updateStatus(
      repository.find(initialAppointment.appointmentId)!,
      "paid",
      {
        amount: 4800,
      },
    );
    repository.save(updated);
    repository.appendAudit({
      eventId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      eventName: "appointment.updated",
      occurredAt: "2026-08-30T07:10:00.000Z",
      appointment: updated,
    });

    expect(repository.find(updated.appointmentId)).toEqual(updated);
    expect(JSON.stringify(repository.listAuditLogs())).toContain(
      initialAppointment.ownerEmail,
    );
    expect(JSON.stringify(repository.listAuditLogs())).toContain(
      initialAppointment.ownerPhone,
    );
  });

  test("壊れた予約JSONを検証せずAppointmentとして返してしまう", () => {
    const { database, repository } = createRepository();
    const malformedState = { status: ["not-a-status"], missing: true };

    repository.reset(initialAppointment);
    database
      .update(appointmentsTable)
      .set({ state: malformedState })
      .where(
        eq(appointmentsTable.appointmentId, initialAppointment.appointmentId),
      )
      .run();

    expect(repository.find(initialAppointment.appointmentId)).toEqual(
      malformedState,
    );
  });

  test("予約がないときだけ初期予約とPIIを含む監査を追加する", () => {
    const { repository } = createRepository();

    repository.seedIfEmpty(initialAppointment);
    repository.seedIfEmpty({ ...initialAppointment, status: "paid" });

    expect(repository.find(initialAppointment.appointmentId)).toEqual(
      initialAppointment,
    );
    expect(repository.listAuditLogs()).toHaveLength(1);
    expect(JSON.stringify(repository.listAuditLogs())).toContain(
      initialAppointment.ownerName,
    );
  });
});
