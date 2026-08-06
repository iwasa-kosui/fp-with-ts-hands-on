import { err, ok } from "neverthrow";
import { describe, expect, it } from "vitest";

import { startExaminationUseCase } from "../src/application/start-examination.js";
import { createInMemoryAppointmentGateway } from "../src/infrastructure/in-memory-appointment-gateway.js";
import type { AppointmentResolver, RepositoryError } from "../src/ports/appointment-resolver.js";
import type { AppointmentStore } from "../src/ports/appointment-store.js";
import { checkedIn, paidAppointment, validRawInput } from "./fixtures.js";

describe("final start examination", () => {
  it("AppointmentStore は aggregate の各状態を atomic save できる", () => {
    const gateway = createInMemoryAppointmentGateway([checkedIn]);

    const result = gateway.store.save(checkedIn, []);

    expect(result.isOk()).toBe(true);
    expect(gateway.saveCalls()).toEqual([{ state: checkedIn, events: [] }]);
    expect(gateway.appointments()).toEqual([checkedIn]);
    expect(gateway.events()).toEqual([]);
  });

  it("成功時だけ状態と event を一回の atomic save で保存する", () => {
    const gateway = createInMemoryAppointmentGateway([checkedIn]);

    const result = startExaminationUseCase(gateway.resolver, gateway.store)(validRawInput);

    expect(result.isOk()).toBe(true);
    expect(gateway.saveCalls()).toHaveLength(1);
    expect(gateway.appointments()).toHaveLength(1);
    expect(gateway.appointments()[0]?.kind).toBe("InExamination");
    expect(gateway.events()).toHaveLength(1);
    expect(gateway.events()[0]?.kind).toBe("ExaminationStarted");
  });

  it("見つからない予約では AppointmentNotFound を返して保存しない", () => {
    const gateway = createInMemoryAppointmentGateway([]);

    const result = startExaminationUseCase(gateway.resolver, gateway.store)(validRawInput);

    expect(result.isErr() && result.error.kind).toBe("AppointmentNotFound");
    expect(gateway.saveCalls()).toEqual([]);
    expect(gateway.events()).toEqual([]);
  });

  it("CheckedIn 以外では InvalidAppointmentState を返して保存しない", () => {
    const gateway = createInMemoryAppointmentGateway([paidAppointment]);

    const result = startExaminationUseCase(gateway.resolver, gateway.store)(validRawInput);

    expect(result.isErr() && result.error.kind).toBe("InvalidAppointmentState");
    expect(gateway.saveCalls()).toEqual([]);
    expect(gateway.events()).toEqual([]);
  });

  it("不正な外部入力を ValidationError として返して resolver を呼ばない", () => {
    let findCalled = false;
    const resolver: AppointmentResolver = {
      findById: () => {
        findCalled = true;
        return ok(checkedIn);
      },
    };
    const store: AppointmentStore = { save: () => ok(undefined) };

    const result = startExaminationUseCase(resolver, store)({
      ...validRawInput,
      eventId: "not-a-uuid",
      occurredAt: "not-a-datetime",
    });

    expect(result.isErr() && result.error.kind).toBe("ValidationError");
    expect(findCalled).toBe(false);
  });

  it("find failure を kind 付き Result error として返す", () => {
    const repositoryError: RepositoryError = { kind: "RepositoryError", operation: "FindById" };
    const resolver: AppointmentResolver = { findById: () => err(repositoryError) };
    const store: AppointmentStore = { save: () => ok(undefined) };

    const result = startExaminationUseCase(resolver, store)(validRawInput);

    expect(result.isErr() && result.error).toEqual(repositoryError);
  });

  it("save failure では state と event のどちらも更新しない", () => {
    const repositoryError: RepositoryError = { kind: "RepositoryError", operation: "Save" };
    const gateway = createInMemoryAppointmentGateway([checkedIn], repositoryError);

    const result = startExaminationUseCase(gateway.resolver, gateway.store)(validRawInput);

    expect(result.isErr() && result.error).toEqual(repositoryError);
    expect(gateway.saveCalls()).toHaveLength(1);
    expect(gateway.appointments()).toEqual([checkedIn]);
    expect(gateway.events()).toEqual([]);
  });
});
