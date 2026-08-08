import { errAsync, okAsync } from "neverthrow";
import { describe, expect, test } from "vitest";
import { sql } from "drizzle-orm";

import {
  createSqliteDatabase,
  migrateDatabase,
} from "../../src/adaptor/secondary/sqlite/db.js";
import { createEventHistoryReader } from "../../src/adaptor/secondary/sqlite/query/eventHistoryReader.js";
import { createFollowUpRequestReader } from "../../src/adaptor/secondary/sqlite/query/followUpRequestReader.js";
import { createAppointmentEventStore } from "../../src/adaptor/secondary/sqlite/store/appointmentEventStore.js";
import { createFollowUpEventStore } from "../../src/adaptor/secondary/sqlite/store/followUpEventStore.js";
import type { Clock } from "../../src/domain/aggregate/clock.js";
import { EventId } from "../../src/domain/aggregate/eventId.js";
import { Timestamp } from "../../src/domain/aggregate/timestamp.js";
import { Appointment } from "../../src/domain/appointment/appointment.js";
import { AppointmentId } from "../../src/domain/appointment/appointmentId.js";
import { AppointmentReason } from "../../src/domain/appointment/appointmentReason.js";
import { Diagnosis } from "../../src/domain/appointment/diagnosis.js";
import { PaymentAmount } from "../../src/domain/appointment/paymentAmount.js";
import { Treatment } from "../../src/domain/appointment/treatment.js";
import { VeterinarianId } from "../../src/domain/appointment/veterinarianId.js";
import { ExamId } from "../../src/domain/examResult/examId.js";
import { ExamResult } from "../../src/domain/examResult/examResult.js";
import type { FollowUpCandidate } from "../../src/domain/followUp/followUpCandidate.js";
import { FollowUpRequested } from "../../src/domain/followUp/followUpRequested.js";
import { Owner } from "../../src/domain/owner/owner.js";
import { OwnerId } from "../../src/domain/owner/ownerId.js";
import { PetId } from "../../src/domain/pet/petId.js";
import { PasswordHash } from "../../src/domain/user/passwordHash.js";
import type { User } from "../../src/domain/user/user.js";
import { UserEmail } from "../../src/domain/user/userEmail.js";
import { UserId } from "../../src/domain/user/userId.js";
import { UserName } from "../../src/domain/user/userName.js";
import { ListEventsUseCase } from "../../src/useCase/listEventsUseCase.js";
import { ListFollowUpsUseCase } from "../../src/useCase/listFollowUpsUseCase.js";
import type { SanitizedAuditRecord } from "../../src/useCase/query/eventHistoryReader.js";
import { RequestFollowUpUseCase } from "../../src/useCase/requestFollowUpUseCase.js";

const ids = {
  admin: UserId.schema.parse("61000000-0000-4000-8000-000000000001"),
  receptionist: UserId.schema.parse("61000000-0000-4000-8000-000000000002"),
  veterinarian: UserId.schema.parse("61000000-0000-4000-8000-000000000003"),
  veterinarianId: VeterinarianId.schema.parse(
    "61000000-0000-4000-8000-000000000004",
  ),
  owner: OwnerId.schema.parse("61000000-0000-4000-8000-000000000005"),
  pet: PetId.schema.parse("61000000-0000-4000-8000-000000000006"),
  otherPet: PetId.schema.parse("61000000-0000-4000-8000-000000000007"),
  appointment: AppointmentId.schema.parse(
    "61000000-0000-4000-8000-000000000008",
  ),
  otherAppointment: AppointmentId.schema.parse(
    "61000000-0000-4000-8000-000000000009",
  ),
  exam: ExamId.schema.parse("61000000-0000-4000-8000-000000000010"),
  otherExam: ExamId.schema.parse("61000000-0000-4000-8000-000000000011"),
  paymentEvent: EventId.schema.parse("61000000-0000-4000-8000-000000000012"),
  followUpEvent: EventId.schema.parse("61000000-0000-4000-8000-000000000013"),
  secondFollowUpEvent: EventId.schema.parse("61000000-0000-4000-8000-000000000017"),
  thirdFollowUpEvent: EventId.schema.parse("61000000-0000-4000-8000-000000000018"),
} as const;
const paymentAt = Timestamp.schema.parse("2026-08-09T02:00:00.000Z");
const followUpAt = Timestamp.schema.parse("2026-08-09T03:00:00.000Z");
const passwordHash = PasswordHash.schema.parse(
  `scrypt$${"A".repeat(22)}==$${"B".repeat(86)}==`,
);
const baseUser = {
  email: UserEmail.schema.parse("user@example.test"),
  name: UserName.schema.parse("Clinic User"),
  passwordHash,
} as const;
const users = [
  { kind: "Admin", userId: ids.admin, ...baseUser },
  { kind: "Receptionist", userId: ids.receptionist, ...baseUser },
  {
    kind: "Veterinarian",
    userId: ids.veterinarian,
    veterinarianId: ids.veterinarianId,
    ...baseUser,
  },
] as const satisfies readonly User[];
const userResolver = {
  resolveById: (userId: UserId) =>
    okAsync(users.find((user) => user.userId === userId)),
};
const noFollowUpRequests = {
  listRequestedAppointmentIds: () => okAsync([]),
};
const owner = Owner.parse({
  ownerId: ids.owner,
  name: "Owner Secret",
  email: "owner@example.test",
  phone: "090-9999-9999",
})._unsafeUnwrap();

const bookedEvent = Appointment.book({
  eventId: EventId.schema.parse("61000000-0000-4000-8000-000000000016"),
  occurredAt: paymentAt,
  actorUserId: ids.receptionist,
})({
  appointmentId: ids.appointment,
  ownerId: ids.owner,
  petId: ids.pet,
  scheduledAt: paymentAt,
  reason: AppointmentReason.schema.parse("private reason"),
});
const checkedInEvent = Appointment.checkIn({
  eventId: EventId.schema.parse("61000000-0000-4000-8000-000000000015"),
  occurredAt: paymentAt,
  actorUserId: ids.receptionist,
})(bookedEvent.aggregateState);
const examinationStartedEvent = Appointment.startExamination({
  eventId: EventId.schema.parse("61000000-0000-4000-8000-000000000014"),
  occurredAt: paymentAt,
  actorUserId: ids.veterinarian,
})(checkedInEvent.aggregateState, ids.veterinarianId);
const paidEvent = Appointment.recordPayment({
  eventId: ids.paymentEvent,
  occurredAt: paymentAt,
  actorUserId: ids.receptionist,
})(
  examinationStartedEvent.aggregateState,
  {
    diagnosis: Diagnosis.schema.parse("private diagnosis"),
    treatment: Treatment.schema.parse("private treatment"),
    amount: PaymentAmount.schema.parse(4800),
  },
);
const examResult = ExamResult.parse({
  examId: ids.exam,
  petId: ids.pet,
  collectedAt: paymentAt,
  items: ["private clinical free text"],
  needsFollowUp: true,
})._unsafeUnwrap();
const candidate = {
  appointment: paidEvent.aggregateState,
  owner,
  examResult,
} as const satisfies FollowUpCandidate;

describe("follow-up use cases", () => {
  test("uses fresh event identity and time instead of payment provenance, and both history rows insert", async () => {
    const db = createSqliteDatabase(":memory:");
    migrateDatabase(db);
    await createAppointmentEventStore(db).store(
      bookedEvent,
      checkedInEvent,
      examinationStartedEvent,
      paidEvent,
    );

    const result = await RequestFollowUpUseCase.create({
      userResolver,
      followUpRequestReader: noFollowUpRequests,
      followUpResolver: { resolveCandidates: () => okAsync([candidate]) },
      followUpRequestedStore: createFollowUpEventStore(db),
      eventIdGenerator: { generate: () => ids.followUpEvent },
      clock: { now: () => followUpAt } as const satisfies Clock,
    }).run({
      actorUserId: ids.receptionist,
      appointmentIds: [ids.appointment],
    });

    expect(result._unsafeUnwrap().appointmentIds).toEqual([ids.appointment]);
    const history = await createEventHistoryReader(db).list(users[0]);
    const events = history._unsafeUnwrap();
    expect(events.map((event) => event.eventId)).toContain(ids.paymentEvent);
    expect(events.map((event) => event.eventId)).toContain(ids.followUpEvent);
    expect(events.at(-1)).toMatchObject({
      occurredAt: followUpAt,
      actorUserId: ids.receptionist,
      eventName: "follow-up.requested",
    });
    expect(
      (
        await createFollowUpRequestReader(db).listRequestedAppointmentIds()
      )._unsafeUnwrap(),
    ).toEqual([ids.appointment]);
  });

  test("validates every candidate before deduplication and stores no partial batch on mismatch", async () => {
    let storeCalls = 0;
    const mismatched = {
      ...candidate,
      appointment: {
        ...candidate.appointment,
        appointmentId: ids.otherAppointment,
      },
      examResult: {
        ...candidate.examResult,
        examId: ids.otherExam,
        petId: ids.otherPet,
      },
    } as const satisfies FollowUpCandidate;
    const result = await RequestFollowUpUseCase.create({
      userResolver,
      followUpRequestReader: noFollowUpRequests,
      followUpResolver: {
        resolveCandidates: () => okAsync([candidate, mismatched]),
      },
      followUpRequestedStore: {
        store: () => {
          storeCalls += 1;
          return okAsync(undefined);
        },
      },
      eventIdGenerator: { generate: () => ids.followUpEvent },
      clock: { now: () => followUpAt },
    }).run({
      actorUserId: ids.receptionist,
      appointmentIds: [ids.appointment],
    });

    expect(result.isErr() && result.error.kind).toBe("ExamResultPetMismatch");
    expect(storeCalls).toBe(0);
  });

  test("deduplicates appointment IDs and submits all events in one store call", async () => {
    const duplicate = {
      ...candidate,
      examResult: { ...candidate.examResult, examId: ids.otherExam },
    } as const satisfies FollowUpCandidate;
    const batches: (readonly FollowUpRequested[])[] = [];
    const result = await RequestFollowUpUseCase.create({
      userResolver,
      followUpRequestReader: noFollowUpRequests,
      followUpResolver: {
        resolveCandidates: () => okAsync([candidate, duplicate]),
      },
      followUpRequestedStore: {
        store: (...events) => {
          batches.push(events);
          return okAsync(undefined);
        },
      },
      eventIdGenerator: { generate: () => ids.followUpEvent },
      clock: { now: () => followUpAt },
    }).run({
      actorUserId: ids.receptionist,
      appointmentIds: [ids.appointment, ids.appointment],
    });

    expect(result.isOk()).toBe(true);
    expect(batches).toHaveLength(1);
    expect(batches[0]).toHaveLength(1);
  });

  test("returns a repository error when the single batch store fails", async () => {
    const result = await RequestFollowUpUseCase.create({
      userResolver,
      followUpRequestReader: noFollowUpRequests,
      followUpResolver: { resolveCandidates: () => okAsync([candidate]) },
      followUpRequestedStore: {
        store: () =>
          errAsync({
            kind: "RepositoryError",
            operation: "batch",
            cause: new Error("private cause"),
          }),
      },
      eventIdGenerator: { generate: () => ids.followUpEvent },
      clock: { now: () => followUpAt },
    }).run({
      actorUserId: ids.receptionist,
      appointmentIds: [ids.appointment],
    });

    expect(result.isErr() && result.error).toEqual({
      kind: "RepositoryError",
      operation: "batch",
    });
  });

  test("returns an early typed conflict without resolving or storing an existing request", async () => {
    let resolverCalls = 0;
    let storeCalls = 0;
    const result = await RequestFollowUpUseCase.create({
      userResolver,
      followUpRequestReader: {
        listRequestedAppointmentIds: () => okAsync([ids.appointment]),
      },
      followUpResolver: {
        resolveCandidates: () => {
          resolverCalls += 1;
          return okAsync([candidate]);
        },
      },
      followUpRequestedStore: {
        store: () => {
          storeCalls += 1;
          return okAsync(undefined);
        },
      },
      eventIdGenerator: { generate: () => ids.followUpEvent },
      clock: { now: () => followUpAt },
    }).run({
      actorUserId: ids.receptionist,
      appointmentIds: [ids.appointment],
    });

    expect(result._unsafeUnwrapErr()).toEqual({
      kind: "FollowUpRequestConflict",
      appointmentId: ids.appointment,
    });
    expect(resolverCalls).toBe(0);
    expect(storeCalls).toBe(0);
  });

  test("rolls back the whole SQLite batch when a later follow-up insert fails", async () => {
    const db = createSqliteDatabase(":memory:");
    migrateDatabase(db);
    const second = {
      ...candidate,
      appointment: {
        ...candidate.appointment,
        appointmentId: ids.otherAppointment,
      },
      examResult: { ...candidate.examResult, examId: ids.otherExam },
    } as const satisfies FollowUpCandidate;
    const result = await RequestFollowUpUseCase.create({
      userResolver,
      followUpRequestReader: noFollowUpRequests,
      followUpResolver: {
        resolveCandidates: () => okAsync([candidate, second]),
      },
      followUpRequestedStore: createFollowUpEventStore(db),
      eventIdGenerator: { generate: () => ids.followUpEvent },
      clock: { now: () => followUpAt },
    }).run({
      actorUserId: ids.receptionist,
      appointmentIds: [ids.appointment, ids.otherAppointment],
    });

    expect(result.isErr() && result.error.kind).toBe("RepositoryError");
    expect(
      (await createEventHistoryReader(db).list(users[0]))._unsafeUnwrap(),
    ).toEqual([]);
    expect(db.all(sql.raw("SELECT appointment_id FROM follow_up_request_claims"))).toEqual([]);
  });

  test("returns a typed conflict for duplicate direct requests and retains one history row", async () => {
    const db = createSqliteDatabase(":memory:");
    migrateDatabase(db);
    const store = createFollowUpEventStore(db);
    const first = FollowUpRequested.create(
      { eventId: ids.followUpEvent, occurredAt: followUpAt, actorUserId: ids.receptionist },
      ids.appointment,
      ids.pet,
    );
    const duplicate = FollowUpRequested.create(
      { eventId: ids.secondFollowUpEvent, occurredAt: followUpAt, actorUserId: ids.receptionist },
      ids.appointment,
      ids.pet,
    );

    expect((await store.store(first)).isOk()).toBe(true);
    expect((await store.store(duplicate))._unsafeUnwrapErr()).toMatchObject({
      kind: "FollowUpRequestConflict",
      appointmentId: ids.appointment,
    });
    expect((await createEventHistoryReader(db).list(users[0]))._unsafeUnwrap()).toHaveLength(1);
    expect(db.all(sql.raw("SELECT appointment_id FROM follow_up_request_claims"))).toEqual([
      { appointment_id: ids.appointment },
    ]);
  });

  test("rolls back a follow-up batch when one appointment was already requested", async () => {
    const db = createSqliteDatabase(":memory:");
    migrateDatabase(db);
    const store = createFollowUpEventStore(db);
    await store.store(FollowUpRequested.create(
      { eventId: ids.followUpEvent, occurredAt: followUpAt, actorUserId: ids.receptionist },
      ids.appointment,
      ids.pet,
    ));
    const result = await store.store(
      FollowUpRequested.create(
        { eventId: ids.secondFollowUpEvent, occurredAt: followUpAt, actorUserId: ids.receptionist },
        ids.otherAppointment,
        ids.otherPet,
      ),
      FollowUpRequested.create(
        { eventId: ids.thirdFollowUpEvent, occurredAt: followUpAt, actorUserId: ids.receptionist },
        ids.appointment,
        ids.pet,
      ),
    );

    expect(result._unsafeUnwrapErr()).toMatchObject({ kind: "FollowUpRequestConflict" });
    const events = (await createEventHistoryReader(db).list(users[0]))._unsafeUnwrap();
    expect(events).toHaveLength(1);
    expect(events[0]?.aggregateId).toBe(ids.appointment);
    expect(db.all(sql.raw("SELECT appointment_id FROM follow_up_request_claims"))).toEqual([
      { appointment_id: ids.appointment },
    ]);
  });

  test("lists validated targets for shared clinic read access", async () => {
    const result = await ListFollowUpsUseCase.create({
      userResolver,
      followUpResolver: { resolveCandidates: () => okAsync([candidate]) },
      followUpRequestReader: {
        listRequestedAppointmentIds: () => okAsync([]),
      },
    }).run({ actorUserId: ids.veterinarian });

    const followUp = result._unsafeUnwrap().followUps[0];
    expect(followUp).toMatchObject({
      appointmentId: ids.appointment,
      petId: ids.pet,
      requested: false,
    });
    expect(followUp?.ownerName?.unwrap()).toBe("Owner Secret");
    expect(followUp?.ownerPhone.unwrap()).toBe("090-9999-9999");
    expect(JSON.stringify(followUp)).not.toContain("Owner Secret");
    expect(JSON.stringify(followUp)).not.toContain("090-9999-9999");
  });
});

describe("event history query", () => {
  const safeAuditRecord = {
    eventId: ids.paymentEvent,
    aggregateId: ids.appointment,
    aggregateName: "Appointment",
    aggregateState: { kind: "Paid", appointmentId: ids.appointment },
    eventName: "appointment.payment-recorded",
    eventPayload: {
      appointmentId: ids.appointment,
    },
    occurredAt: paymentAt,
    actorUserId: ids.receptionist,
  } as const satisfies SanitizedAuditRecord;

  test("rejects non-Admin before resolving events", async () => {
    let eventHistoryReaderCalls = 0;
    const result = await ListEventsUseCase.create({
      userResolver,
      eventHistoryReader: {
        list: () => {
          eventHistoryReaderCalls += 1;
          return okAsync([safeAuditRecord]);
        },
      },
    }).run({ actorUserId: ids.receptionist });

    expect(result.isErr() && result.error.kind).toBe("Unauthorized");
    expect(eventHistoryReaderCalls).toBe(0);
  });

  test("passes the resolved Admin capability and returns reader DTOs unchanged", async () => {
    let receivedAdmin: User | undefined;
    const result = await ListEventsUseCase.create({
      userResolver,
      eventHistoryReader: {
        list: (admin) => {
          receivedAdmin = admin;
          return okAsync([safeAuditRecord]);
        },
      },
    }).run({ actorUserId: ids.admin });

    const serialized = JSON.stringify(result._unsafeUnwrap());
    expect(result._unsafeUnwrap().events[0]).toMatchObject({
      eventId: ids.paymentEvent,
      aggregateId: ids.appointment,
      aggregateName: "Appointment",
      eventName: "appointment.payment-recorded",
      occurredAt: paymentAt,
      actorUserId: ids.receptionist,
    });
    expect(receivedAdmin?.kind).toBe("Admin");
    expect(receivedAdmin?.userId).toBe(ids.admin);
    expect(serialized).toBe(JSON.stringify({ events: [safeAuditRecord] }));
  });
});
