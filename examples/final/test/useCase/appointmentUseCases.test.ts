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
import { AppointmentDuration } from "../../src/domain/appointment/appointmentDuration.js";
import type {
  AppointmentEvent,
  AppointmentExaminationCompleted,
} from "../../src/domain/appointment/appointmentEvent.js";
import { AppointmentId } from "../../src/domain/appointment/appointmentId.js";
import { AppointmentReason } from "../../src/domain/appointment/appointmentReason.js";
import { AppointmentVersion } from "../../src/domain/appointment/appointmentVersion.js";
import { CancellationReason } from "../../src/domain/appointment/cancellationReason.js";
import { Diagnosis } from "../../src/domain/appointment/diagnosis.js";
import { PaymentAmount } from "../../src/domain/appointment/paymentAmount.js";
import { ReceptionNote } from "../../src/domain/appointment/receptionNote.js";
import { ServiceCode } from "../../src/domain/appointment/serviceCode.js";
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
import {
  ListAppointmentsUseCase,
  toAppointmentView,
} from "../../src/useCase/listAppointmentsUseCase.js";
import { RecordExamResultUseCase } from "../../src/useCase/recordExamResultUseCase.js";
import { RecordPaymentUseCase } from "../../src/useCase/recordPaymentUseCase.js";
import { StartExaminationUseCase } from "../../src/useCase/startExaminationUseCase.js";
import { UpdateAppointmentUseCase } from "../../src/useCase/updateAppointmentUseCase.js";
import { RegisterWalkInUseCase } from "../../src/useCase/registerWalkInUseCase.js";
import { ReassignAppointmentVeterinarianUseCase } from "../../src/useCase/reassignAppointmentVeterinarianUseCase.js";
import { ListVeterinariansUseCase } from "../../src/useCase/listVeterinariansUseCase.js";

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
      userListResolver: { resolveAll: () => okAsync(users) },
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
    expect(booked._unsafeUnwrap().appointment).toMatchObject({
      kind: "Scheduled",
      serviceCode: "GeneralConsultation",
      durationMinutes: 30,
      bookingKind: "Reserved",
      assignedVeterinarianId: null,
      receptionNote: null,
      settlement: { kind: "NoPayment" },
      version: 1,
    });

    const checkedIn = await CheckInAppointmentUseCase.create({
      userResolver,
      appointmentResolver: { resolveById: () => okAsync(appointment) },
      appointmentCheckedInStore: appointmentStore,
      clock,
      eventIdGenerator: eventIds,
    }).run({ actorUserId: ids.receptionist, appointmentId: ids.appointment });
    expect(checkedIn._unsafeUnwrap().appointment).toMatchObject({
      kind: "CheckedIn",
      version: 2,
    });

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
    expect(started._unsafeUnwrap().appointment).toMatchObject({
      kind: "InExamination",
      assignedVeterinarianId: ids.veterinarian,
      version: 3,
    });

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
      version: 4,
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

    expect(paid._unsafeUnwrap().appointment).toMatchObject({
      kind: "Paid",
      version: 5,
      settlement: {
        kind: "Settled",
        depositAmount: 0,
        additionalPaymentAmount: 4800,
        refundAmount: 0,
      },
    });
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
      userListResolver: { resolveAll: () => okAsync(users) },
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

  test("rejects an unknown assigned veterinarian before booking is stored", async () => {
    let storeCalls = 0;
    const unknownVeterinarianId = VeterinarianId.schema.parse(
      "51000000-0000-4000-8000-000000000099",
    );
    const result = await BookAppointmentUseCase.create({
      userResolver,
      userListResolver: { resolveAll: () => okAsync(users) },
      ownerResolver,
      petResolver,
      appointmentBookedStore: {
        store: () => {
          storeCalls += 1;
          return okAsync(undefined);
        },
      },
      appointmentIdGenerator: { generate: () => ids.appointment },
      clock,
      eventIdGenerator: eventIdGenerator(),
    }).run({
      actorUserId: ids.receptionist,
      ownerId: ids.owner,
      petId: ids.pet,
      scheduledAt: times.scheduled,
      reason: AppointmentReason.schema.parse("checkup"),
      assignedVeterinarianId: unknownVeterinarianId,
    });

    expect(result._unsafeUnwrapErr()).toEqual({
      kind: "VeterinarianNotFound",
      veterinarianId: unknownVeterinarianId,
    });
    expect(storeCalls).toBe(0);
  });

  test("maps synchronous examination-completion dependency failures without storing", async () => {
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

    for (const dependency of ["clock", "examIdGenerator", "eventIdGenerator"] as const) {
      let storeCalls = 0;
      const generatedEventIds = eventIdGenerator();
      const throwFailure = (): never => {
        throw new Error(`${dependency} failed`);
      };
      const result = await RecordExamResultUseCase.create({
        userResolver,
        appointmentResolver: { resolveById: () => okAsync(examining) },
        examinationCompletionStore: {
          store: () => {
            storeCalls += 1;
            return okAsync(undefined);
          },
        },
        examIdGenerator: {
          generate: dependency === "examIdGenerator" ? throwFailure : () => ids.exam,
        },
        clock: {
          now: dependency === "clock" ? throwFailure : () => times.now,
        },
        eventIdGenerator: {
          generate:
            dependency === "eventIdGenerator"
              ? throwFailure
              : generatedEventIds.generate,
        },
      }).run({
        actorUserId: ids.veterinarianUser,
        appointmentId: ids.appointment,
        petId: ids.pet,
        collectedAt: times.now,
        items: [ExamResultItem.schema.parse("observation")],
        needsFollowUp: false,
      });

      expect(result._unsafeUnwrapErr()).toEqual({
        kind: "IdentityGenerationFailed",
      });
      expect(storeCalls).toBe(0);
    }
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
      kind: "StaleAppointmentVersion",
      appointmentId: ids.appointment,
      expectedVersion: 2,
    });
    expect(await db.select().from(appointmentsTable)).toHaveLength(1);
    expect(await db.select().from(domainEventsTable)).toHaveLength(3);
  });

  test("updates only Scheduled appointments, checks expectedVersion, and preserves prepaid immutable fields", async () => {
    const scheduled = Appointment.book({
      eventId: eventIdGenerator().generate(),
      occurredAt: times.now,
      actorUserId: ids.receptionist,
    })({
      appointmentId: ids.appointment,
      ownerId: ids.owner,
      petId: ids.pet,
      scheduledAt: times.scheduled,
      durationMinutes: AppointmentDuration.schema.parse(15),
      serviceCode: ServiceCode.schema.parse("Vaccination"),
      bookingKind: "Reserved",
      assignedVeterinarianId: null,
      visitReason: AppointmentReason.schema.parse("vaccination"),
      receptionNote: null,
      settlement: {
        kind: "DepositReceived",
        depositAmount: PaymentAmount.schema.parse(1000),
        receivedAt: times.now,
      },
    }).aggregateState;
    let current: AppointmentState = scheduled;
    let storeCalls = 0;
    const useCase = UpdateAppointmentUseCase.create({
      userResolver,
      ownerResolver,
      petResolver,
      userListResolver: { resolveAll: () => okAsync(users) },
      appointmentResolver: { resolveById: () => okAsync(current) },
      appointmentUpdatedStore: {
        store: (event) => {
          storeCalls += 1;
          current = event.aggregateState;
          return okAsync(undefined);
        },
      },
      clock,
      eventIdGenerator: eventIdGenerator(),
    });
    const valid = await useCase.run({
      actorUserId: ids.receptionist,
      appointmentId: ids.appointment,
      expectedVersion: scheduled.version,
      ownerId: ids.owner,
      petId: ids.pet,
      scheduledAt: Timestamp.schema.parse("2026-08-10T02:00:00.000Z"),
      durationMinutes: AppointmentDuration.schema.parse(30),
      serviceCode: scheduled.serviceCode,
      assignedVeterinarianId: ids.veterinarian,
      visitReason: AppointmentReason.schema.parse("changed reason"),
    });
    expect(valid._unsafeUnwrap().appointment).toMatchObject({ version: 2, durationMinutes: 30 });

    current = scheduled;
    const immutable = await useCase.run({
      actorUserId: ids.receptionist,
      appointmentId: ids.appointment,
      expectedVersion: scheduled.version,
      ownerId: ids.owner,
      petId: ids.pet,
      scheduledAt: times.scheduled,
      durationMinutes: scheduled.durationMinutes,
      serviceCode: ServiceCode.schema.parse("GeneralConsultation"),
      assignedVeterinarianId: null,
      visitReason: scheduled.visitReason,
    });
    expect(immutable._unsafeUnwrapErr()).toMatchObject({
      kind: "PrepaidAppointmentImmutableFieldsChanged",
    });

    const stale = await useCase.run({
      actorUserId: ids.receptionist,
      appointmentId: ids.appointment,
      expectedVersion: AppointmentVersion.schema.parse(2),
      ownerId: ids.owner,
      petId: ids.pet,
      scheduledAt: times.scheduled,
      durationMinutes: scheduled.durationMinutes,
      serviceCode: scheduled.serviceCode,
      assignedVeterinarianId: null,
      visitReason: scheduled.visitReason,
    });
    expect(stale._unsafeUnwrapErr()).toMatchObject({ kind: "StaleAppointmentVersion" });

    current = Appointment.checkIn({
      eventId: eventIdGenerator().generate(),
      occurredAt: times.now,
      actorUserId: ids.receptionist,
    })(scheduled).aggregateState;
    const invalidState = await useCase.run({
      actorUserId: ids.receptionist,
      appointmentId: ids.appointment,
      expectedVersion: current.version,
      ownerId: ids.owner,
      petId: ids.pet,
      scheduledAt: times.scheduled,
      durationMinutes: scheduled.durationMinutes,
      serviceCode: scheduled.serviceCode,
      assignedVeterinarianId: null,
      visitReason: scheduled.visitReason,
    });
    expect(invalidState._unsafeUnwrapErr()).toMatchObject({ kind: "InvalidAppointmentState" });
    expect(storeCalls).toBe(1);
  });

  test("registers walk-ins with the server clock and reassigns Scheduled or CheckedIn appointments", async () => {
    let stored: AppointmentState | undefined;
    const common = {
      userResolver,
      ownerResolver,
      petResolver,
      userListResolver: { resolveAll: () => okAsync(users) },
      clock,
      eventIdGenerator: eventIdGenerator(),
    } as const;
    const walkIn = await RegisterWalkInUseCase.create({
      ...common,
      appointmentWalkInRegisteredStore: {
        store: (event) => {
          stored = event.aggregateState;
          return okAsync(undefined);
        },
      },
      appointmentIdGenerator: { generate: () => ids.appointment },
    }).run({
      actorUserId: ids.receptionist,
      ownerId: ids.owner,
      petId: ids.pet,
      durationMinutes: AppointmentDuration.schema.parse(15),
      serviceCode: ServiceCode.schema.parse("FollowUpVisit"),
      assignedVeterinarianId: null,
      visitReason: AppointmentReason.schema.parse("walk in"),
      receptionNote: ReceptionNote.schema.parse("private note"),
    });
    expect(walkIn._unsafeUnwrap().appointment).toMatchObject({
      kind: "CheckedIn",
      bookingKind: "WalkIn",
      scheduledAt: times.now,
      checkedInAt: times.now,
      version: 1,
    });

    const reassign = await ReassignAppointmentVeterinarianUseCase.create({
      userResolver,
      userListResolver: common.userListResolver,
      appointmentResolver: { resolveById: () => okAsync(stored) },
      appointmentVeterinarianReassignedStore: {
        store: (event) => {
          stored = event.aggregateState;
          return okAsync(undefined);
        },
      },
      clock,
      eventIdGenerator: eventIdGenerator(),
    }).run({
      actorUserId: ids.receptionist,
      appointmentId: ids.appointment,
      expectedVersion: AppointmentVersion.schema.parse(1),
      assignedVeterinarianId: ids.veterinarian,
    });
    expect(reassign._unsafeUnwrap().appointment).toMatchObject({
      kind: "CheckedIn",
      assignedVeterinarianId: ids.veterinarian,
      version: 2,
    });
  });

  test("lists only veterinarian IDs and display names for every authenticated clinic role", async () => {
    const result = await ListVeterinariansUseCase.create({
      userResolver,
      userListResolver: { resolveAll: () => okAsync(users) },
    }).run({ actorUserId: ids.veterinarianUser });

    expect(result._unsafeUnwrap()).toEqual({
      veterinarians: [{ veterinarianId: ids.veterinarian, name: userBase.name }],
    });
  });
});

describe("appointment query use cases", () => {
  test("projects every appointment variant with operational values, narrowed settlement, and version", () => {
    const eventIds = eventIdGenerator();
    const visitReason = AppointmentReason.schema.parse("private specialist visit");
    const receptionNote = ReceptionNote.schema.parse("private reception note");
    const depositAmount = PaymentAmount.schema.parse(1200);
    const scheduled = Appointment.book({
      eventId: eventIds.generate(),
      occurredAt: times.now,
      actorUserId: ids.receptionist,
    })({
      appointmentId: ids.appointment,
      ownerId: ids.owner,
      petId: ids.pet,
      scheduledAt: times.scheduled,
      durationMinutes: AppointmentDuration.schema.parse(45),
      serviceCode: ServiceCode.schema.parse("ExaminationOrProcedure"),
      bookingKind: "WalkIn",
      assignedVeterinarianId: ids.veterinarian,
      visitReason,
      receptionNote,
      settlement: {
        kind: "DepositReceived",
        depositAmount,
        receivedAt: times.now,
      },
    }).aggregateState;
    const checkedIn = Appointment.checkIn({
      eventId: eventIds.generate(),
      occurredAt: times.now,
      actorUserId: ids.receptionist,
    })(scheduled).aggregateState;
    const examining = Appointment.startExamination({
      eventId: eventIds.generate(),
      occurredAt: times.now,
      actorUserId: ids.veterinarianUser,
    })(checkedIn, ids.veterinarian).aggregateState;
    const awaitingPayment = Appointment.completeExamination({
      eventId: eventIds.generate(),
      occurredAt: times.now,
      actorUserId: ids.veterinarianUser,
    })(examining, { examId: ids.exam }).aggregateState;
    const diagnosis = Diagnosis.schema.parse("private diagnosis");
    const treatment = Treatment.schema.parse("private treatment");
    const paid = Appointment.recordPayment({
      eventId: eventIds.generate(),
      occurredAt: times.now,
      actorUserId: ids.receptionist,
    })(awaitingPayment, {
      diagnosis,
      treatment,
      amount: PaymentAmount.schema.parse(4800),
    }).aggregateState;
    const cancellationReason = CancellationReason.schema.parse(
      "private cancellation reason",
    );
    const canceled = Appointment.cancel({
      eventId: eventIds.generate(),
      occurredAt: times.now,
      actorUserId: ids.receptionist,
    })(checkedIn, cancellationReason).aggregateState;
    const project = toAppointmentView([owner], [pet], users);
    const common = {
      appointmentId: ids.appointment,
      ownerId: ids.owner,
      petId: ids.pet,
      scheduledAt: times.scheduled,
      durationMinutes: 45,
      serviceCode: "ExaminationOrProcedure",
      bookingKind: "WalkIn",
      visitReason,
      receptionNote,
    } as const;

    expect(project(scheduled)).toMatchObject({
      ...common,
      kind: "Scheduled",
      assignedVeterinarianId: ids.veterinarian,
      settlement: {
        kind: "DepositReceived",
        depositAmount,
        receivedAt: times.now,
      },
      version: 1,
    });
    expect(project(checkedIn)).toMatchObject({
      ...common,
      kind: "CheckedIn",
      assignedVeterinarianId: ids.veterinarian,
      settlement: { kind: "DepositReceived", depositAmount },
      checkedInAt: times.now,
      version: 2,
    });
    expect(project(examining)).toMatchObject({
      ...common,
      kind: "InExamination",
      assignedVeterinarianId: ids.veterinarian,
      settlement: { kind: "DepositReceived", depositAmount },
      checkedInAt: times.now,
      examinationStartedAt: times.now,
      version: 3,
    });
    expect(project(awaitingPayment)).toMatchObject({
      ...common,
      kind: "AwaitingPayment",
      assignedVeterinarianId: ids.veterinarian,
      settlement: { kind: "DepositReceived", depositAmount },
      examId: ids.exam,
      version: 4,
    });
    expect(project(paid)).toMatchObject({
      ...common,
      kind: "Paid",
      assignedVeterinarianId: ids.veterinarian,
      diagnosis,
      treatment,
      settlement: {
        kind: "Settled",
        finalAmount: 4800,
        depositAmount: 1200,
        additionalPaymentAmount: 3600,
        refundAmount: 0,
        settledAt: times.now,
      },
      amount: 4800,
      paidAt: times.now,
      version: 5,
    });
    expect(project(canceled)).toMatchObject({
      ...common,
      kind: "Canceled",
      assignedVeterinarianId: ids.veterinarian,
      cancellationReason,
      settlement: {
        kind: "DepositRefunded",
        depositAmount,
        refundedAt: times.now,
      },
      canceledAt: times.now,
      version: 3,
    });
  });

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
