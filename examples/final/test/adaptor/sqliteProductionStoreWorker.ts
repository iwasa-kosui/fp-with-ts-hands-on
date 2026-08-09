import { parentPort, workerData } from "node:worker_threads";
import { writeFileSync } from "node:fs";
import { z } from "zod";

import { createSqliteDatabase } from "../../src/adaptor/secondary/sqlite/db.js";
import { createAppointmentEventStore } from "../../src/adaptor/secondary/sqlite/store/appointmentEventStore.js";
import { EventId } from "../../src/domain/aggregate/eventId.js";
import { Timestamp } from "../../src/domain/aggregate/timestamp.js";
import { Appointment } from "../../src/domain/appointment/appointment.js";
import { AppointmentDuration } from "../../src/domain/appointment/appointmentDuration.js";
import { AppointmentId } from "../../src/domain/appointment/appointmentId.js";
import { AppointmentReason } from "../../src/domain/appointment/appointmentReason.js";
import type { AppointmentStoreError } from "../../src/domain/appointment/appointmentStores.js";
import { ServiceCode } from "../../src/domain/appointment/serviceCode.js";
import { VeterinarianId } from "../../src/domain/appointment/veterinarianId.js";
import { OwnerId } from "../../src/domain/owner/ownerId.js";
import { PetId } from "../../src/domain/pet/petId.js";
import { UserId } from "../../src/domain/user/userId.js";

const ProbeInputSchema = z.object({ kind: z.literal("Probe") });
const RunInputSchema = z.object({
  kind: z.literal("Run"),
  databasePath: z.string().min(1),
  resultPath: z.string().min(1),
  startSignal: z.instanceof(SharedArrayBuffer),
  attemptSignal: z.instanceof(SharedArrayBuffer),
  appointmentId: AppointmentId.schema,
  petId: PetId.schema,
  ownerId: OwnerId.schema,
  assignedVeterinarianId: VeterinarianId.schema,
  eventId: EventId.schema,
  actorUserId: UserId.schema,
  occurredAt: Timestamp.schema,
  scheduledAt: Timestamp.schema,
});
const WorkerInputSchema = z.discriminatedUnion("kind", [ProbeInputSchema, RunInputSchema]);

const serializeError = (error: AppointmentStoreError): Readonly<Record<string, unknown>> => {
  switch (error.kind) {
    case "VeterinarianScheduleConflict":
      return error;
    case "RepositoryError":
      return {
        kind: error.kind,
        operation: error.operation,
        cause: error.cause instanceof Error ? error.cause.message : String(error.cause),
      };
    case "StaleAppointmentVersion":
      return error;
  }
};

if (parentPort === null) {
  throw new Error("sqliteProductionStoreWorker requires a parent port");
}

const port = parentPort;
const input = WorkerInputSchema.parse(workerData);
if (input.kind === "Probe") {
  void createAppointmentEventStore;
  port.postMessage("ready");
} else {
  const db = createSqliteDatabase(input.databasePath);
  try {
    port.postMessage("ready");
    const startSignal = new Int32Array(input.startSignal);
    Atomics.wait(startSignal, 0, 0);
    const attemptSignal = new Int32Array(input.attemptSignal);
    Atomics.store(attemptSignal, 0, 1);
    Atomics.notify(attemptSignal, 0);
    port.postMessage("attempting");

    const booked = Appointment.book({
      eventId: input.eventId,
      occurredAt: input.occurredAt,
      actorUserId: input.actorUserId,
    })({
      appointmentId: input.appointmentId,
      petId: input.petId,
      ownerId: input.ownerId,
      scheduledAt: input.scheduledAt,
      durationMinutes: AppointmentDuration.schema.parse(30),
      serviceCode: ServiceCode.schema.parse("GeneralConsultation"),
      bookingKind: "Reserved",
      assignedVeterinarianId: input.assignedVeterinarianId,
      visitReason: AppointmentReason.schema.parse("concurrent private reason 55"),
      receptionNote: null,
      settlement: { kind: "NoPayment" },
    });
    const startedAt = performance.now();
    const result = await createAppointmentEventStore(db).store(booked);
    const elapsedMilliseconds = performance.now() - startedAt;
    writeFileSync(input.resultPath, JSON.stringify(result.match(
      () => ({ kind: "Ok", elapsedMilliseconds }),
      (error) => ({ kind: "Err", error: serializeError(error), elapsedMilliseconds }),
    )));
    port.postMessage("completed");
  } finally {
    db.$client.close();
    port.postMessage("closed");
  }
}
