import { errAsync, okAsync } from "neverthrow";
import { describe, expect, it } from "vitest";

import { Appointment } from "../src/domain/appointment.js";
import { AppointmentId } from "../src/domain/appointmentId.js";
import { OwnerId } from "../src/domain/ownerId.js";
import { PetId } from "../src/domain/petId.js";
import { Timestamp } from "../src/domain/timestamp.js";
import { VeterinarianId } from "../src/domain/veterinarianId.js";
import type { AppointmentResolver } from "../src/domain/appointmentResolver.js";
import type {
  AppointmentConflict,
  AppointmentStoreError,
  ExaminationStartedStore,
} from "../src/domain/appointmentStores.js";
import type { RepositoryError } from "../src/domain/repositoryError.js";
import { StartExaminationUseCase } from "../src/useCase/startExaminationUseCase.js";

const rawInput = {
  appointmentId: "11111111-1111-4111-8111-111111111111",
  veterinarianId: "44444444-4444-4444-8444-444444444444",
  startedAt: "2026-08-30T06:30:00.000Z",
} as const;
const appointmentId = AppointmentId.schema.parse(rawInput.appointmentId);
const scheduled = Appointment.book({
  appointmentId,
  petId: PetId.schema.parse("22222222-2222-4222-8222-222222222222"),
  ownerId: OwnerId.schema.parse("33333333-3333-4333-8333-333333333333"),
  scheduledAt: Timestamp.schema.parse("2026-08-30T06:00:00.000Z"),
});
const checkedIn = Appointment.checkIn(
  scheduled,
  Timestamp.schema.parse("2026-08-30T06:10:00.000Z"),
);
const repositoryError: RepositoryError = {
  kind: "RepositoryError",
  operation: "test",
  cause: new Error("repository unavailable"),
};
const appointmentConflict: AppointmentConflict = {
  kind: "AppointmentConflict",
  appointmentId,
};

describe("StartExaminationUseCase", () => {
  it("予約を解決してから成功イベントを一つの store port へ渡す", async () => {
    const calls: string[] = [];
    const storedEvents: unknown[] = [];
    const appointmentResolver = {
      resolveById: () => {
        calls.push("resolve");
        return okAsync(checkedIn);
      },
    } as const satisfies AppointmentResolver;
    const examinationStartedStore = {
      store: (event) => {
        calls.push("store");
        storedEvents.push(event);
        return okAsync(undefined);
      },
    } as const satisfies ExaminationStartedStore;
    const useCase = StartExaminationUseCase.create({
      appointmentResolver,
      examinationStartedStore,
    });

    const result = await useCase.run(rawInput);

    expect(result.isOk()).toBe(true);
    expect(calls).toEqual(["resolve", "store"]);
    expect(storedEvents).toHaveLength(1);
    expect(storedEvents[0]).toMatchObject({
      kind: "AppointmentExaminationStarted",
      aggregateId: appointmentId,
      aggregateState: { kind: "InExamination" },
    });
  });

  it("受付済みでない予約では store port を呼ばない", async () => {
    const storedEvents: unknown[] = [];
    const useCase = StartExaminationUseCase.create({
      appointmentResolver: {
        resolveById: () => okAsync(scheduled),
      } as const satisfies AppointmentResolver,
      examinationStartedStore: {
        store: (event) => {
          storedEvents.push(event);
          return okAsync(undefined);
        },
      } as const satisfies ExaminationStartedStore,
    });

    const result = await useCase.run(rawInput);

    expect(result.isErr() && result.error.kind).toBe("InvalidAppointmentState");
    expect(storedEvents).toEqual([]);
  });

  it("resolver の RepositoryError を同じ typed value のまま返す", async () => {
    let storeCalls = 0;
    const useCase = StartExaminationUseCase.create({
      appointmentResolver: {
        resolveById: () => errAsync(repositoryError),
      } as const satisfies AppointmentResolver,
      examinationStartedStore: {
        store: () => {
          storeCalls += 1;
          return okAsync(undefined);
        },
      } as const satisfies ExaminationStartedStore,
    });

    const result = await useCase.run(rawInput);

    expect(result._unsafeUnwrapErr()).toBe(repositoryError);
    expect(storeCalls).toBe(0);
  });

  it.each([
    { name: "AppointmentConflict", error: appointmentConflict },
    { name: "RepositoryError", error: repositoryError },
  ] as const satisfies readonly Readonly<{
    name: string;
    error: AppointmentStoreError;
  }>[])("store の $name を同じ typed value のまま返す", async ({ error }) => {
    const useCase = StartExaminationUseCase.create({
      appointmentResolver: {
        resolveById: () => okAsync(checkedIn),
      } as const satisfies AppointmentResolver,
      examinationStartedStore: {
        store: () => errAsync(error),
      } as const satisfies ExaminationStartedStore,
    });

    const result = await useCase.run(rawInput);

    expect(result._unsafeUnwrapErr()).toBe(error);
  });
});
