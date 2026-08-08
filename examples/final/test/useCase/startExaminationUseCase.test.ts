import { errAsync, okAsync, type ResultAsync } from "neverthrow";
import { describe, expect, test } from "vitest";

import type { Clock } from "../../src/domain/aggregate/clock.js";
import { EventId } from "../../src/domain/aggregate/eventId.js";
import type { EventIdGenerator } from "../../src/domain/aggregate/eventIdGenerator.js";
import type { RepositoryError } from "../../src/domain/aggregate/repositoryError.js";
import { Timestamp } from "../../src/domain/aggregate/timestamp.js";
import {
  type Appointment,
  type CheckedIn,
  type Scheduled,
} from "../../src/domain/appointment/appointment.js";
import type { ExaminationStarted } from "../../src/domain/appointment/appointmentEvent.js";
import { AppointmentId } from "../../src/domain/appointment/appointmentId.js";
import type { AppointmentResolver } from "../../src/domain/appointment/appointmentResolver.js";
import type { ExaminationStartedStore } from "../../src/domain/appointment/appointmentStores.js";
import { VeterinarianId } from "../../src/domain/appointment/veterinarianId.js";
import { OwnerId } from "../../src/domain/owner-id.js";
import { PetId } from "../../src/domain/pet-id.js";
import {
  type User,
  type Veterinarian,
} from "../../src/domain/user/user.js";
import { UserEmail } from "../../src/domain/user/userEmail.js";
import { UserId } from "../../src/domain/user/userId.js";
import { UserName } from "../../src/domain/user/userName.js";
import type { UserResolver } from "../../src/domain/user/userResolver.js";
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
  reason: "skin check",
  checkedInAt: Timestamp.schema.parse("2026-08-30T06:20:00.000Z"),
} as const satisfies CheckedIn;

const scheduled = {
  ...checkedIn,
  kind: "Scheduled",
} as const satisfies Scheduled;

const repositoryError: RepositoryError = {
  kind: "RepositoryError",
  operation: "test",
  cause: new Error("database unavailable"),
};

const userResolverFor = (user: User | undefined): UserResolver =>
  ({
    resolveById: () => okAsync(user),
    resolveByEmail: () => okAsync(undefined),
    resolveAll: () => okAsync([]),
  }) as const satisfies UserResolver;

const appointmentResolverFor = (
  appointment: Appointment | undefined,
): AppointmentResolver =>
  ({
    resolveById: () => okAsync(appointment),
  }) as const satisfies AppointmentResolver;

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
        } as const satisfies AppointmentResolver,
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
        } as const satisfies AppointmentResolver,
      }),
    );

    const result = await useCase.run({ ...input, veterinarianId: otherVeterinarianId });

    expect(result.isErr() && result.error.kind).toBe("Unauthorized");
    expect(appointmentResolverCalled).toBe(false);
  });

  test("returns a user resolver RepositoryError without resolving the appointment", async () => {
    let appointmentResolverCalled = false;
    const useCase = StartExaminationUseCase.create(
      createDependencies({
        userResolver: {
          resolveById: () => errAsync(repositoryError),
          resolveByEmail: () => errAsync(repositoryError),
          resolveAll: () => errAsync(repositoryError),
        } as const satisfies UserResolver,
        appointmentResolver: {
          resolveById: () => {
            appointmentResolverCalled = true;
            return okAsync(checkedIn);
          },
        } as const satisfies AppointmentResolver,
      }),
    );

    const result = await useCase.run(input);

    expect(result.isErr() && result.error).toBe(repositoryError);
    expect(appointmentResolverCalled).toBe(false);
  });

  test("returns an appointment resolver RepositoryError without storing", async () => {
    const storedEvents: ExaminationStarted[] = [];
    const useCase = StartExaminationUseCase.create(
      createDependencies({
        appointmentResolver: {
          resolveById: () => errAsync(repositoryError),
        } as const satisfies AppointmentResolver,
        examinationStartedStore: successfulStore(storedEvents),
      }),
    );

    const result = await useCase.run(input);

    expect(result.isErr() && result.error).toBe(repositoryError);
    expect(storedEvents).toHaveLength(0);
  });

  test("returns a store RepositoryError after producing the event", async () => {
    const receivedEvents: ExaminationStarted[] = [];
    const failingStore = {
      store: (...events: readonly ExaminationStarted[]): ResultAsync<void, RepositoryError> => {
        receivedEvents.push(...events);
        return errAsync(repositoryError);
      },
    } as const satisfies ExaminationStartedStore;
    const useCase = StartExaminationUseCase.create(
      createDependencies({ examinationStartedStore: failingStore }),
    );

    const result = await useCase.run(input);

    expect(result.isErr() && result.error).toBe(repositoryError);
    expect(receivedEvents).toHaveLength(1);
    expect(receivedEvents[0]?.kind).toBe("ExaminationStarted");
  });
});
