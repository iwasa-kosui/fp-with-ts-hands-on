import { okAsync, ResultAsync } from "neverthrow";
import { describe, expect, test } from "vitest";

import type { Clock } from "../../src/domain/aggregate/clock.js";
import { EventId } from "../../src/domain/aggregate/eventId.js";
import type { EventIdGenerator } from "../../src/domain/aggregate/eventIdGenerator.js";
import { Timestamp } from "../../src/domain/aggregate/timestamp.js";
import {
  type Appointment,
  type CheckedIn,
  type Scheduled,
} from "../../src/domain/appointment/appointment.js";
import type { ExaminationStarted } from "../../src/domain/appointment/appointmentEvent.js";
import { AppointmentId } from "../../src/domain/appointment/appointmentId.js";
import { AppointmentReason } from "../../src/domain/appointment/appointmentReason.js";
import type { AppointmentByIdResolver } from "../../src/domain/appointment/appointmentResolver.js";
import type { ExaminationStartedStore } from "../../src/domain/appointment/appointmentStores.js";
import { VeterinarianId } from "../../src/domain/appointment/veterinarianId.js";
import { OwnerId } from "../../src/domain/owner/ownerId.js";
import { PetId } from "../../src/domain/pet/petId.js";
import {
  type User,
  type Veterinarian,
} from "../../src/domain/user/user.js";
import { UserEmail } from "../../src/domain/user/userEmail.js";
import { UserId } from "../../src/domain/user/userId.js";
import { UserName } from "../../src/domain/user/userName.js";
import type { UserByIdResolver } from "../../src/domain/user/userResolver.js";
import { PasswordHash } from "../../src/domain/user/passwordHash.js";
import {
  type Dependencies,
  StartExaminationUseCase,
} from "../../src/useCase/startExaminationUseCase.js";

const actorUserId = UserId.schema.parse("55555555-5555-4555-8555-555555555555");
const appointmentId = AppointmentId.schema.parse(
  "11111111-1111-4111-8111-111111111111",
);
const veterinarianId = VeterinarianId.schema.parse(
  "44444444-4444-4444-8444-444444444444",
);
const otherVeterinarianId = VeterinarianId.schema.parse(
  "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
);
const eventId = EventId.schema.parse("66666666-6666-4666-8666-666666666666");
const startedAt = Timestamp.schema.parse("2026-08-30T06:30:00.000Z");

const input = {
  actorUserId,
  appointmentId,
  veterinarianId,
} as const;

const admin = {
  kind: "Admin",
  userId: actorUserId,
  email: UserEmail.schema.parse("admin@example.test"),
  name: UserName.schema.parse("Admin"),
  passwordHash: PasswordHash.schema.parse(
    `scrypt$YWJjZGVmZ2hpamtsbW5vcA==$${"A".repeat(86)}==`,
  ),
} as const satisfies User;

const receptionist = {
  ...admin,
  kind: "Receptionist",
} as const satisfies User;

const veterinarian = {
  ...admin,
  kind: "Veterinarian",
  veterinarianId,
} as const satisfies Veterinarian;

const checkedIn = {
  kind: "CheckedIn",
  appointmentId,
  petId: PetId.schema.parse("22222222-2222-4222-8222-222222222222"),
  ownerId: OwnerId.schema.parse("33333333-3333-4333-8333-333333333333"),
  scheduledAt: Timestamp.schema.parse("2026-08-30T06:00:00.000Z"),
  reason: AppointmentReason.schema.parse("skin check"),
  checkedInAt: Timestamp.schema.parse("2026-08-30T06:20:00.000Z"),
} as const satisfies CheckedIn;

const scheduled = {
  ...checkedIn,
  kind: "Scheduled",
} as const satisfies Scheduled;

const infrastructureError = new Error("database unavailable");

const userResolverFor = (user: User | undefined): UserByIdResolver =>
  ({
    resolveById: () => okAsync(user),
  }) as const satisfies UserByIdResolver;

const appointmentResolverFor = (
  appointment: Appointment | undefined,
): AppointmentByIdResolver =>
  ({
    resolveById: () => okAsync(appointment),
  }) as const satisfies AppointmentByIdResolver;

const successfulStore = (
  storedEvents: ExaminationStarted[],
): ExaminationStartedStore =>
  ({
    store: (...events) => {
      storedEvents.push(...events);
      return okAsync(undefined);
    },
  }) as const satisfies ExaminationStartedStore;

const createDependencies = (
  overrides: Readonly<Partial<Dependencies>> = {},
): Dependencies =>
  ({
    userResolver: userResolverFor(admin),
    appointmentResolver: appointmentResolverFor(checkedIn),
    examinationStartedStore: successfulStore([]),
    clock: { now: () => startedAt } as const satisfies Clock,
    eventIdGenerator: { generate: () => eventId } as const satisfies EventIdGenerator,
    ...overrides,
  }) as const satisfies Dependencies;

describe("StartExaminationUseCase", () => {
  test("stores one ExaminationStarted event and returns its InExamination state", async () => {
    const storedEvents: ExaminationStarted[] = [];
    const useCase = StartExaminationUseCase.create(
      createDependencies({ examinationStartedStore: successfulStore(storedEvents) }),
    );

    const result = await useCase.run(input);

    expect(result.isOk()).toBe(true);
    expect(storedEvents).toHaveLength(1);
    expect(storedEvents[0]?.kind).toBe("ExaminationStarted");
    expect(storedEvents[0]?.aggregateState.kind).toBe("InExamination");
    expect(result._unsafeUnwrap()).toEqual({
      appointment: {
        ...checkedIn,
        kind: "InExamination",
        veterinarianId,
        examinationStartedAt: startedAt,
      },
    });
  });

  test("returns AppointmentNotFound without storing when the appointment is missing", async () => {
    const storedEvents: ExaminationStarted[] = [];
    const useCase = StartExaminationUseCase.create(
      createDependencies({
        appointmentResolver: appointmentResolverFor(undefined),
        examinationStartedStore: successfulStore(storedEvents),
      }),
    );

    const result = await useCase.run(input);

    expect(result.isErr() && result.error).toEqual({
      kind: "AppointmentNotFound",
      appointmentId,
    });
    expect(storedEvents).toHaveLength(0);
  });

  test("returns InvalidAppointmentState without storing when the appointment is not CheckedIn", async () => {
    const storedEvents: ExaminationStarted[] = [];
    const useCase = StartExaminationUseCase.create(
      createDependencies({
        appointmentResolver: appointmentResolverFor(scheduled),
        examinationStartedStore: successfulStore(storedEvents),
      }),
    );

    const result = await useCase.run(input);

    expect(result.isErr() && result.error).toEqual({
      kind: "InvalidAppointmentState",
      appointmentId,
      expectedKind: "CheckedIn",
      actualKind: "Scheduled",
    });
    expect(storedEvents).toHaveLength(0);
  });

  test("returns Unauthorized without resolving the appointment for a receptionist", async () => {
    let appointmentResolverCalled = false;
    const useCase = StartExaminationUseCase.create(
      createDependencies({
        userResolver: userResolverFor(receptionist),
        appointmentResolver: {
          resolveById: () => {
            appointmentResolverCalled = true;
            return okAsync(checkedIn);
          },
        } as const satisfies AppointmentByIdResolver,
      }),
    );

    const result = await useCase.run(input);

    expect(result.isErr() && result.error.kind).toBe("Unauthorized");
    expect(appointmentResolverCalled).toBe(false);
  });

  test("returns Unauthorized without resolving the appointment when a veterinarian selects another veterinarian", async () => {
    let appointmentResolverCalled = false;
    const useCase = StartExaminationUseCase.create(
      createDependencies({
        userResolver: userResolverFor(veterinarian),
        appointmentResolver: {
          resolveById: () => {
            appointmentResolverCalled = true;
            return okAsync(checkedIn);
          },
        } as const satisfies AppointmentByIdResolver,
      }),
    );

    const result = await useCase.run({ ...input, veterinarianId: otherVeterinarianId });

    expect(result.isErr() && result.error.kind).toBe("Unauthorized");
    expect(appointmentResolverCalled).toBe(false);
  });

  test("rejects a user resolver failure without resolving the appointment", async () => {
    let appointmentResolverCalled = false;
    const useCase = StartExaminationUseCase.create(
      createDependencies({
        userResolver: {
          resolveById: () =>
            ResultAsync.fromSafePromise(Promise.reject(infrastructureError)),
        } as const satisfies UserByIdResolver,
        appointmentResolver: {
          resolveById: () => {
            appointmentResolverCalled = true;
            return okAsync(checkedIn);
          },
        } as const satisfies AppointmentByIdResolver,
      }),
    );

    await expect(useCase.run(input)).rejects.toBe(infrastructureError);
    expect(appointmentResolverCalled).toBe(false);
  });

  test("rejects an appointment resolver failure without storing", async () => {
    const storedEvents: ExaminationStarted[] = [];
    const useCase = StartExaminationUseCase.create(
      createDependencies({
        appointmentResolver: {
          resolveById: () =>
            ResultAsync.fromSafePromise(Promise.reject(infrastructureError)),
        } as const satisfies AppointmentByIdResolver,
        examinationStartedStore: successfulStore(storedEvents),
      }),
    );

    await expect(useCase.run(input)).rejects.toBe(infrastructureError);
    expect(storedEvents).toHaveLength(0);
  });

  test("rejects a store failure after producing the event", async () => {
    const receivedEvents: ExaminationStarted[] = [];
    const failingStore = {
      store: (...events: readonly ExaminationStarted[]) => {
        receivedEvents.push(...events);
        return ResultAsync.fromSafePromise(Promise.reject(infrastructureError));
      },
    } as const satisfies ExaminationStartedStore;
    const useCase = StartExaminationUseCase.create(
      createDependencies({ examinationStartedStore: failingStore }),
    );

    await expect(useCase.run(input)).rejects.toBe(infrastructureError);
    expect(receivedEvents).toHaveLength(1);
    expect(receivedEvents[0]?.kind).toBe("ExaminationStarted");
  });

  test("returns IdentityGenerationFailed without storing when event ID generation throws", async () => {
    const storedEvents: ExaminationStarted[] = [];
    const useCase = StartExaminationUseCase.create(
      createDependencies({
        eventIdGenerator: {
          generate: () => {
            throw new Error("event ID unavailable");
          },
        },
        examinationStartedStore: successfulStore(storedEvents),
      }),
    );

    const result = await useCase.run(input);

    expect(result.isErr() && result.error).toEqual({
      kind: "IdentityGenerationFailed",
    });
    expect(storedEvents).toHaveLength(0);
  });

  test("returns IdentityGenerationFailed without storing when the clock throws", async () => {
    const storedEvents: ExaminationStarted[] = [];
    const useCase = StartExaminationUseCase.create(
      createDependencies({
        clock: {
          now: () => {
            throw new Error("clock unavailable");
          },
        },
        examinationStartedStore: successfulStore(storedEvents),
      }),
    );

    const result = await useCase.run(input);

    expect(result.isErr() && result.error).toEqual({
      kind: "IdentityGenerationFailed",
    });
    expect(storedEvents).toHaveLength(0);
  });
});
