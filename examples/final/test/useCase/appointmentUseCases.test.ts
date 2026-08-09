import { okAsync } from "neverthrow";
import { describe, expect, test } from "vitest";

import {
  createSqliteDatabase,
  migrateDatabase,
} from "../../src/adaptor/secondary/sqlite/db.js";
import { createAppointmentListResolver } from "../../src/adaptor/secondary/sqlite/resolver/appointmentResolver.js";
import { createAppointmentEventStore } from "../../src/adaptor/secondary/sqlite/store/appointmentEventStore.js";
import { createExaminationCompletionStore } from "../../src/adaptor/secondary/sqlite/store/examinationCompletionStore.js";
import { appointmentsTable, domainEventsTable } from "../../src/adaptor/secondary/sqlite/schema.js";
import type { Clock } from "../../src/domain/aggregate/clock.js";
import { EventId } from "../../src/domain/aggregate/eventId.js";
import type { EventIdGenerator } from "../../src/domain/aggregate/eventIdGenerator.js";
import { Timestamp } from "../../src/domain/aggregate/timestamp.js";
import {
  Appointment,
  type Appointment as AppointmentState,
} from "../../src/domain/appointment/appointment.js";
import type {
  AppointmentEvent,
  AppointmentExaminationCompleted,
} from "../../src/domain/appointment/appointmentEvent.js";
import { AppointmentId } from "../../src/domain/appointment/appointmentId.js";
import { AppointmentReason } from "../../src/domain/appointment/appointmentReason.js";
import { CancellationReason } from "../../src/domain/appointment/cancellationReason.js";
import { Diagnosis } from "../../src/domain/appointment/diagnosis.js";
import { PaymentAmount } from "../../src/domain/appointment/paymentAmount.js";
import { Treatment } from "../../src/domain/appointment/treatment.js";
import { VeterinarianId } from "../../src/domain/appointment/veterinarianId.js";
import { ExamId } from "../../src/domain/examResult/examId.js";
import { ExamResult } from "../../src/domain/examResult/examResult.js";
import { ExamResultItem } from "../../src/domain/examResult/examResultItem.js";
import type { ExamResultRecorded } from "../../src/domain/examResult/examResultEvent.js";
import {
  Owner,
  type Owner as OwnerState,
} from "../../src/domain/owner/owner.js";
import { OwnerId } from "../../src/domain/owner/ownerId.js";
import { Pet, type Pet as PetState } from "../../src/domain/pet/pet.js";
import { PetId } from "../../src/domain/pet/petId.js";
import { PasswordHash } from "../../src/domain/user/passwordHash.js";
import type { User } from "../../src/domain/user/user.js";
import { UserEmail } from "../../src/domain/user/userEmail.js";
import { UserId } from "../../src/domain/user/userId.js";
import { UserName } from "../../src/domain/user/userName.js";
import { BookAppointmentUseCase } from "../../src/useCase/bookAppointmentUseCase.js";
import { CancelAppointmentUseCase } from "../../src/useCase/cancelAppointmentUseCase.js";
import { CheckInAppointmentUseCase } from "../../src/useCase/checkInAppointmentUseCase.js";
import { GetAppointmentUseCase } from "../../src/useCase/getAppointmentUseCase.js";
import { GetDashboardUseCase } from "../../src/useCase/getDashboardUseCase.js";
import { ListAppointmentsUseCase } from "../../src/useCase/listAppointmentsUseCase.js";
import { RecordExamResultUseCase } from "../../src/useCase/recordExamResultUseCase.js";
import { RecordPaymentUseCase } from "../../src/useCase/recordPaymentUseCase.js";
import { StartExaminationUseCase } from "../../src/useCase/startExaminationUseCase.js";

const ids = {
  admin: UserId.schema.parse("51000000-0000-4000-8000-000000000001"),
  receptionist: UserId.schema.parse("51000000-0000-4000-8000-000000000002"),
  veterinarianUser: UserId.schema.parse("51000000-0000-4000-8000-000000000003"),
  veterinarian: VeterinarianId.schema.parse(
    "51000000-0000-4000-8000-000000000004",
  ),
  owner: OwnerId.schema.parse("51000000-0000-4000-8000-000000000005"),
  otherOwner: OwnerId.schema.parse("51000000-0000-4000-8000-000000000006"),
  pet: PetId.schema.parse("51000000-0000-4000-8000-000000000007"),
  otherPet: PetId.schema.parse("51000000-0000-4000-8000-000000000008"),
  appointment: AppointmentId.schema.parse(
    "51000000-0000-4000-8000-000000000009",
  ),
  exam: ExamId.schema.parse("51000000-0000-4000-8000-000000000010"),
} as const;
const times = {
  scheduled: Timestamp.schema.parse("2026-08-10T01:00:00.000Z"),
  now: Timestamp.schema.parse("2026-08-09T01:00:00.000Z"),
} as const;
const passwordHash = PasswordHash.schema.parse(
  `scrypt$${"A".repeat(22)}==$${"B".repeat(86)}==`,
);
const userBase = {
  email: UserEmail.schema.parse("clinic@example.test"),
  name: UserName.schema.parse("Clinic User"),
  passwordHash,
} as const;
const users = [
  { kind: "Admin", userId: ids.admin, ...userBase },
  { kind: "Receptionist", userId: ids.receptionist, ...userBase },
  {
    kind: "Veterinarian",
    userId: ids.veterinarianUser,
    veterinarianId: ids.veterinarian,
    ...userBase,
  },
] as const satisfies readonly User[];
const owner = Owner.parse({
  ownerId: ids.owner,
  name: "Owner A",
  email: "owner@example.test",
  phone: "090-1111-2222",
})._unsafeUnwrap();
const pet = Pet.parse({
  petId: ids.pet,
  ownerId: ids.owner,
  name: "Mugi",
  species: "Cat",
})._unsafeUnwrap();
const otherPet = Pet.parse({
  petId: ids.otherPet,
  ownerId: ids.otherOwner,
  name: "Sora",
  species: "Dog",
})._unsafeUnwrap();

const clock = { now: () => times.now } as const satisfies Clock;
const eventIdGenerator = (): EventIdGenerator => {
  let sequence = 1;
  return {
    generate: () =>
      EventId.schema.parse(
        `52000000-0000-4000-8000-${(sequence++).toString().padStart(12, "0")}`,
      ),
  };
};
const userResolver = {
  resolveById: (userId: UserId) =>
    okAsync(users.find((user) => user.userId === userId)),
};
const ownerResolver = {
  resolveById: (ownerId: OwnerId) =>
    okAsync(ownerId === owner.ownerId ? owner : undefined),
};
const petResolver = {
  resolveById: (petId: PetId) =>
    okAsync([pet, otherPet].find((item) => item.petId === petId)),
};

describe("appointment command use cases", () => {
  test("runs booking through examination result and payment with typed events", async () => {
    let appointment: AppointmentState | undefined;
    const appointmentEvents: AppointmentEvent[] = [];
    const examEvents: ExamResultRecorded[] = [];
    const appointmentStore = {
      store: (...events: readonly AppointmentEvent[]) => {
        appointmentEvents.push(...events);
        appointment = events.at(-1)?.aggregateState;
        return okAsync(undefined);
      },
    };
    const eventIds = eventIdGenerator();

    const booked = await BookAppointmentUseCase.create({
      userResolver,
      ownerResolver,
      petResolver,
      appointmentBookedStore: appointmentStore,
      appointmentIdGenerator: { generate: () => ids.appointment },
      clock,
      eventIdGenerator: eventIds,
    }).run({
      actorUserId: ids.receptionist,
      ownerId: ids.owner,
      petId: ids.pet,
      scheduledAt: times.scheduled,
      reason: AppointmentReason.schema.parse("persistent cough"),
    });
    expect(booked._unsafeUnwrap().appointment.kind).toBe("Scheduled");

    const checkedIn = await CheckInAppointmentUseCase.create({
      userResolver,
      appointmentResolver: { resolveById: () => okAsync(appointment) },
      appointmentCheckedInStore: appointmentStore,
      clock,
      eventIdGenerator: eventIds,
    }).run({ actorUserId: ids.receptionist, appointmentId: ids.appointment });
    expect(checkedIn._unsafeUnwrap().appointment.kind).toBe("CheckedIn");

    const started = await StartExaminationUseCase.create({
      userResolver,
      appointmentResolver: { resolveById: () => okAsync(appointment) },
      examinationStartedStore: appointmentStore,
      clock,
      eventIdGenerator: eventIds,
    }).run({
      actorUserId: ids.veterinarianUser,
      appointmentId: ids.appointment,
      veterinarianId: ids.veterinarian,
    });
    expect(started._unsafeUnwrap().appointment.kind).toBe("InExamination");

    const exam = await RecordExamResultUseCase.create({
      userResolver,
      appointmentResolver: { resolveById: () => okAsync(appointment) },
      examinationCompletionStore: {
        store: (examEvent, appointmentEvent) => {
          examEvents.push(examEvent);
          appointmentEvents.push(appointmentEvent);
          appointment = appointmentEvent.aggregateState;
          return okAsync(undefined);
        },
      },
      examIdGenerator: { generate: () => ids.exam },
      clock,
      eventIdGenerator: eventIds,
    }).run({
      actorUserId: ids.veterinarianUser,
      appointmentId: ids.appointment,
      petId: ids.pet,
      collectedAt: times.now,
      items: [ExamResultItem.schema.parse("private clinical observation")],
      needsFollowUp: true,
    });
    expect(exam._unsafeUnwrap().examResult.items[0]?.unwrap()).toBe(
      "private clinical observation",
    );
    expect(exam._unsafeUnwrap().appointment).toMatchObject({
      kind: "AwaitingPayment",
      examId: ids.exam,
    });

    const paid = await RecordPaymentUseCase.create({
      userResolver,
      appointmentResolver: { resolveById: () => okAsync(appointment) },
      paymentRecordedStore: appointmentStore,
      clock,
      eventIdGenerator: eventIds,
    }).run({
      actorUserId: ids.receptionist,
      appointmentId: ids.appointment,
      diagnosis: Diagnosis.schema.parse("dermatitis"),
      treatment: Treatment.schema.parse("ointment"),
      amount: PaymentAmount.schema.parse(4800),
    });

    expect(paid._unsafeUnwrap().appointment.kind).toBe("Paid");
    expect(appointmentEvents.map((event) => event.kind)).toEqual([
      "AppointmentBooked",
      "AppointmentCheckedIn",
      "ExaminationStarted",
      "AppointmentExaminationCompleted",
      "PaymentRecorded",
    ]);
    expect(examEvents).toHaveLength(1);
  });

  test("rejects pet-owner mismatch and examination-result pet mismatch without storing", async () => {
    const bookedEvents: AppointmentEvent[] = [];
    const booking = await BookAppointmentUseCase.create({
      userResolver,
      ownerResolver,
      petResolver,
      appointmentBookedStore: {
        store: (...events) => {
          bookedEvents.push(...events);
          return okAsync(undefined);
        },
      },
      appointmentIdGenerator: { generate: () => ids.appointment },
      clock,
      eventIdGenerator: eventIdGenerator(),
    }).run({
      actorUserId: ids.receptionist,
      ownerId: ids.owner,
      petId: ids.otherPet,
      scheduledAt: times.scheduled,
      reason: AppointmentReason.schema.parse("checkup"),
    });
    expect(booking.isErr() && booking.error.kind).toBe("PetOwnerMismatch");
    expect(bookedEvents).toHaveLength(0);

    const examining = Appointment.startExamination({
      eventId: eventIdGenerator().generate(),
      occurredAt: times.now,
      actorUserId: ids.veterinarianUser,
    })(
      Appointment.checkIn({
        eventId: eventIdGenerator().generate(),
        occurredAt: times.now,
        actorUserId: ids.receptionist,
      })(
        Appointment.book({
          eventId: eventIdGenerator().generate(),
          occurredAt: times.now,
          actorUserId: ids.receptionist,
        })({
          appointmentId: ids.appointment,
          ownerId: ids.owner,
          petId: ids.pet,
          scheduledAt: times.scheduled,
          reason: AppointmentReason.schema.parse("checkup"),
        }).aggregateState,
      ).aggregateState,
      ids.veterinarian,
    ).aggregateState;
    const examEvents: ExamResultRecorded[] = [];
    const completionEvents: AppointmentExaminationCompleted[] = [];
    const exam = await RecordExamResultUseCase.create({
      userResolver,
      appointmentResolver: { resolveById: () => okAsync(examining) },
      examinationCompletionStore: {
        store: (examEvent, appointmentEvent) => {
          examEvents.push(examEvent);
          completionEvents.push(appointmentEvent);
          return okAsync(undefined);
        },
      },
      examIdGenerator: { generate: () => ids.exam },
      clock,
      eventIdGenerator: eventIdGenerator(),
    }).run({
      actorUserId: ids.veterinarianUser,
      appointmentId: ids.appointment,
      petId: ids.otherPet,
      collectedAt: times.now,
      items: [ExamResultItem.schema.parse("observation")],
      needsFollowUp: false,
    });
    expect(exam.isErr() && exam.error.kind).toBe("ExamResultPetMismatch");
    expect(examEvents).toHaveLength(0);
    expect(completionEvents).toHaveLength(0);
  });

  test("rejects unauthorized roles before protected appointment resolvers", async () => {
    let appointmentResolverCalls = 0;
    const result = await CheckInAppointmentUseCase.create({
      userResolver,
      appointmentResolver: {
        resolveById: () => {
          appointmentResolverCalls += 1;
          return okAsync(undefined);
        },
      },
      appointmentCheckedInStore: { store: () => okAsync(undefined) },
      clock,
      eventIdGenerator: eventIdGenerator(),
    }).run({
      actorUserId: ids.veterinarianUser,
      appointmentId: ids.appointment,
    });

    expect(result.isErr() && result.error.kind).toBe("Unauthorized");
    expect(appointmentResolverCalls).toBe(0);
  });

  test("returns IdentityGenerationFailed when an appointment event ID cannot be generated", async () => {
    const scheduled = Appointment.book({
      eventId: eventIdGenerator().generate(),
      occurredAt: times.now,
      actorUserId: ids.receptionist,
    })({
      appointmentId: ids.appointment,
      ownerId: ids.owner,
      petId: ids.pet,
      scheduledAt: times.scheduled,
      reason: AppointmentReason.schema.parse("checkup"),
    }).aggregateState;
    const result = await CheckInAppointmentUseCase.create({
      userResolver,
      appointmentResolver: { resolveById: () => okAsync(scheduled) },
      appointmentCheckedInStore: { store: () => okAsync(undefined) },
      clock,
      eventIdGenerator: {
        generate: () => {
          throw new Error("generator unavailable");
        },
      },
    }).run({ actorUserId: ids.receptionist, appointmentId: ids.appointment });

    expect(result.isErr() && result.error).toEqual({
      kind: "IdentityGenerationFailed",
    });
  });

  test("cancels Scheduled appointments and rejects terminal-state cancellation", async () => {
    const scheduled = Appointment.book({
      eventId: eventIdGenerator().generate(),
      occurredAt: times.now,
      actorUserId: ids.receptionist,
    })({
      appointmentId: ids.appointment,
      ownerId: ids.owner,
      petId: ids.pet,
      scheduledAt: times.scheduled,
      reason: AppointmentReason.schema.parse("checkup"),
    }).aggregateState;
    const canceled = await CancelAppointmentUseCase.create({
      userResolver,
      appointmentResolver: { resolveById: () => okAsync(scheduled) },
      appointmentCanceledStore: { store: () => okAsync(undefined) },
      clock,
      eventIdGenerator: eventIdGenerator(),
    }).run({
      actorUserId: ids.receptionist,
      appointmentId: ids.appointment,
      reason: CancellationReason.schema.parse("owner request"),
    });
    expect(canceled._unsafeUnwrap().appointment.kind).toBe("Canceled");

    const terminal = canceled._unsafeUnwrap().appointment;
    const conflict = await CancelAppointmentUseCase.create({
      userResolver,
      appointmentResolver: { resolveById: () => okAsync(terminal) },
      appointmentCanceledStore: { store: () => okAsync(undefined) },
      clock,
      eventIdGenerator: eventIdGenerator(),
    }).run({
      actorUserId: ids.receptionist,
      appointmentId: ids.appointment,
      reason: CancellationReason.schema.parse("again"),
    });
    expect(conflict.isErr() && conflict.error.kind).toBe(
      "InvalidAppointmentState",
    );
  });

  test("returns one typed conflict when coordinated use cases resolve the same stale state", async () => {
    const db = createSqliteDatabase(":memory:");
    migrateDatabase(db);
    const store = createAppointmentEventStore(db);
    const eventIds = eventIdGenerator();
    const booked = Appointment.book({
      eventId: eventIds.generate(),
      occurredAt: times.now,
      actorUserId: ids.receptionist,
    })({
      appointmentId: ids.appointment,
      ownerId: ids.owner,
      petId: ids.pet,
      scheduledAt: times.scheduled,
      reason: AppointmentReason.schema.parse("private reason"),
    });
    const checkedIn = Appointment.checkIn({
      eventId: eventIds.generate(),
      occurredAt: times.now,
      actorUserId: ids.receptionist,
    })(booked.aggregateState);
    await store.store(booked, checkedIn);
    const staleResolver = { resolveById: () => okAsync(checkedIn.aggregateState) };

    const [started, canceled] = await Promise.all([
      StartExaminationUseCase.create({
        userResolver,
        appointmentResolver: staleResolver,
        examinationStartedStore: store,
        clock,
        eventIdGenerator: eventIds,
      }).run({
        actorUserId: ids.veterinarianUser,
        appointmentId: ids.appointment,
        veterinarianId: ids.veterinarian,
      }),
      CancelAppointmentUseCase.create({
        userResolver,
        appointmentResolver: staleResolver,
        appointmentCanceledStore: store,
        clock,
        eventIdGenerator: eventIds,
      }).run({
        actorUserId: ids.receptionist,
        appointmentId: ids.appointment,
        reason: CancellationReason.schema.parse("private cancellation"),
      }),
    ]);

    expect([started, canceled].filter((result) => result.isOk())).toHaveLength(1);
    expect([started, canceled].find((result) => result.isErr())?._unsafeUnwrapErr()).toMatchObject({
      kind: "AppointmentConflict",
      appointmentId: ids.appointment,
    });
    expect(await db.select().from(appointmentsTable)).toHaveLength(1);
    expect(await db.select().from(domainEventsTable)).toHaveLength(3);
  });
});

describe("appointment query use cases", () => {
  test("retains terminal appointments and labels deleted owner, pet, and veterinarian records", async () => {
    const db = createSqliteDatabase(":memory:");
    migrateDatabase(db);
    const eventIds = eventIdGenerator();
    const booked = Appointment.book({
      eventId: eventIds.generate(),
      occurredAt: times.now,
      actorUserId: ids.receptionist,
    })({
      appointmentId: ids.appointment,
      ownerId: ids.owner,
      petId: ids.pet,
      scheduledAt: times.scheduled,
      reason: AppointmentReason.schema.parse("private reason"),
    });
    const checkedIn = Appointment.checkIn({
      eventId: eventIds.generate(),
      occurredAt: times.now,
      actorUserId: ids.receptionist,
    })(booked.aggregateState);
    const examinationStarted = Appointment.startExamination({
      eventId: eventIds.generate(),
      occurredAt: times.now,
      actorUserId: ids.veterinarianUser,
    })(checkedIn.aggregateState, ids.veterinarian);
    const examResult = ExamResult.parse({
      examId: ids.exam,
      petId: ids.pet,
      collectedAt: times.now,
      items: ["private clinical observation"],
      needsFollowUp: false,
    })._unsafeUnwrap();
    const examResultRecorded = ExamResult.create({
      eventId: eventIds.generate(),
      occurredAt: times.now,
      actorUserId: ids.veterinarianUser,
    })(examResult);
    const examinationCompleted = Appointment.completeExamination({
      eventId: eventIds.generate(),
      occurredAt: times.now,
      actorUserId: ids.veterinarianUser,
    })(examinationStarted.aggregateState, { examId: ids.exam });
    const payment = Appointment.recordPayment({
      eventId: eventIds.generate(),
      occurredAt: times.now,
      actorUserId: ids.receptionist,
    })(examinationCompleted.aggregateState, {
      diagnosis: Diagnosis.schema.parse("private diagnosis"),
      treatment: Treatment.schema.parse("private treatment"),
      amount: PaymentAmount.schema.parse(4800),
    });
    const initialStoreResult = await createAppointmentEventStore(db).store(
      booked,
      checkedIn,
      examinationStarted,
    );
    const completionStoreResult = await createExaminationCompletionStore(db).store(
      examResultRecorded,
      examinationCompleted,
    );
    const paymentStoreResult = await createAppointmentEventStore(db).store(payment);
    expect(initialStoreResult).toMatchObject({ value: undefined });
    expect(completionStoreResult).toMatchObject({ value: undefined });
    expect(paymentStoreResult).toMatchObject({ value: undefined });

    const result = await ListAppointmentsUseCase.create({
      userResolver,
      appointmentListResolver: createAppointmentListResolver(db),
      ownerListResolver: {
        resolveAll: () =>
          okAsync([] as const satisfies readonly OwnerState[]),
      },
      petListResolver: {
        resolveAll: () =>
          okAsync([] as const satisfies readonly PetState[]),
      },
      userListResolver: {
        resolveAll: () => okAsync([] as const satisfies readonly User[]),
      },
    }).run({ actorUserId: ids.veterinarianUser });

    expect(result).toMatchObject({
      value: {
        appointments: [
          {
            kind: "Paid",
            ownerName: undefined,
            petName: undefined,
            veterinarianName: undefined,
          },
        ],
      },
    });
  });

  test("shares appointment detail and dashboard reads across authenticated roles", async () => {
    const scheduled = Appointment.book({
      eventId: eventIdGenerator().generate(),
      occurredAt: times.now,
      actorUserId: ids.receptionist,
    })({
      appointmentId: ids.appointment,
      ownerId: ids.owner,
      petId: ids.pet,
      scheduledAt: times.scheduled,
      reason: AppointmentReason.schema.parse("checkup"),
    }).aggregateState;
    const detail = await GetAppointmentUseCase.create({
      userResolver,
      appointmentResolver: { resolveById: () => okAsync(scheduled) },
      ownerResolver,
      petResolver,
      veterinarianResolver: { resolveAll: () => okAsync(users) },
    }).run({
      actorUserId: ids.veterinarianUser,
      appointmentId: ids.appointment,
    });
    expect(detail._unsafeUnwrap().appointment.ownerName?.unwrap()).toBe("Owner A");
    expect(detail._unsafeUnwrap().appointment.petName?.unwrap()).toBe("Mugi");
    expect(JSON.stringify(detail)).not.toContain("Owner A");
    expect(JSON.stringify(detail)).not.toContain("Mugi");

    const dashboard = await GetDashboardUseCase.create({
      userResolver,
      appointmentListResolver: { resolveAll: () => okAsync([scheduled]) },
      ownerListResolver: { resolveAll: () => okAsync([owner]) },
      petListResolver: { resolveAll: () => okAsync([pet]) },
      userListResolver: { resolveAll: () => okAsync(users) },
    }).run({ actorUserId: ids.veterinarianUser });
    expect(dashboard._unsafeUnwrap().counts).toEqual({
      owners: 1,
      pets: 1,
      appointments: 1,
      activeAppointments: 1,
    });
  });
});
