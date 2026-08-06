import { err, ok } from "neverthrow";
import { describe, expect, it } from "vitest";

import { startExaminationUseCase } from "../src/application/start-examination.js";
import { AppointmentId } from "../src/domain/appointment-id.js";
import { createInMemoryAppointmentGateway } from "../src/infrastructure/in-memory-appointment-gateway.js";
import type { AppointmentResolver, RepositoryError } from "../src/ports/appointment-resolver.js";
import type { AppointmentStore } from "../src/ports/appointment-store.js";
import { checkedIn, validRawInput } from "./fixtures.js";

const appointmentId = AppointmentId.parse("11111111-1111-4111-8111-111111111111")._unsafeUnwrap();

describe("Session 05 start examination", () => {
  it("状態とイベントを一度の save で保存する", () => {
    const gateway = createInMemoryAppointmentGateway([checkedIn]);

    const result = startExaminationUseCase(gateway.resolver, gateway.store)(validRawInput);

    expect(result.isOk()).toBe(true);
    expect(gateway.saveCalls()).toHaveLength(1);
    expect(gateway.appointments()[0]?.kind).toBe("InExamination");
    expect(gateway.events()).toHaveLength(1);
    expect(gateway.events()[0]?.kind).toBe("ExaminationStarted");
  });

  it("見つからない予約では保存せず AppointmentNotFound を返す", () => {
    const gateway = createInMemoryAppointmentGateway([]);

    const result = startExaminationUseCase(gateway.resolver, gateway.store)(validRawInput);

    expect(result.isErr() && result.error.kind).toBe("AppointmentNotFound");
    expect(gateway.saveCalls()).toEqual([]);
    expect(gateway.events()).toEqual([]);
  });

  it("CheckedIn 以外の予約では保存せず InvalidAppointmentState を返す", () => {
    const scheduled = { ...checkedIn, kind: "Scheduled" as const };
    const gateway = createInMemoryAppointmentGateway([scheduled]);

    const result = startExaminationUseCase(gateway.resolver, gateway.store)(validRawInput);

    expect(result.isErr() && result.error.kind).toBe("InvalidAppointmentState");
    expect(gateway.saveCalls()).toEqual([]);
    expect(gateway.events()).toEqual([]);
  });

  it("不正な event ID と日時を境界で拒否する", () => {
    const gateway = createInMemoryAppointmentGateway([checkedIn]);

    const invalidEventId = startExaminationUseCase(gateway.resolver, gateway.store)({
      ...validRawInput,
      eventId: "not-a-uuid",
    });
    const invalidTimestamp = startExaminationUseCase(gateway.resolver, gateway.store)({
      ...validRawInput,
      occurredAt: "not-a-datetime",
    });

    expect(invalidEventId.isErr() && invalidEventId.error.kind).toBe("ValidationError");
    expect(invalidTimestamp.isErr() && invalidTimestamp.error.kind).toBe("ValidationError");
    expect(gateway.saveCalls()).toEqual([]);
    expect(gateway.events()).toEqual([]);
  });

  it("repository の読み取り失敗を Result error として返す", () => {
    const repositoryError: RepositoryError = { kind: "RepositoryError", operation: "FindById" };
    const resolver: AppointmentResolver = { findById: () => err(repositoryError) };
    const store: AppointmentStore = { save: () => ok(undefined) };

    const result = startExaminationUseCase(resolver, store)(validRawInput);

    expect(result.isErr() && result.error).toEqual(repositoryError);
  });

  it("保存失敗を Result error として返し、呼び出し元に返す", () => {
    const repositoryError: RepositoryError = { kind: "RepositoryError", operation: "Save" };
    const resolver: AppointmentResolver = { findById: () => ok(checkedIn) };
    const store: AppointmentStore = { save: () => err(repositoryError) };

    const result = startExaminationUseCase(resolver, store)(validRawInput);

    expect(result.isErr() && result.error).toEqual(repositoryError);
    expect(appointmentId).toEqual(checkedIn.appointmentId);
  });
});
