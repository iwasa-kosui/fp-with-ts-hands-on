import { okAsync } from "neverthrow";
import { describe, expect, it } from "vitest";

import { Appointment } from "../src/domain/appointment.js";
import { AppointmentId } from "../src/domain/appointmentId.js";
import { ExamId } from "../src/domain/examId.js";
import {
  collectFollowUpTargets,
  type FollowUpCandidate,
} from "../src/domain/followUp/collectFollowUpTargets.js";
import type { FollowUpRequested } from "../src/domain/followUp/followUpRequested.js";
import { OwnerContact } from "../src/domain/ownerContact.js";
import { OwnerId } from "../src/domain/ownerId.js";
import { PaymentAmount } from "../src/domain/paymentAmount.js";
import { PetId } from "../src/domain/petId.js";
import { Timestamp } from "../src/domain/timestamp.js";
import { VeterinarianId } from "../src/domain/veterinarianId.js";
import type { User } from "../src/domain/user/user.js";
import { UserId } from "../src/domain/user/userId.js";
import { RequestFollowUpUseCase } from "../src/useCase/requestFollowUpUseCase.js";

const appointmentId = AppointmentId.schema.parse(
  "11111111-1111-4111-8111-111111111111",
);
const petId = PetId.schema.parse("22222222-2222-4222-8222-222222222222");
const ownerId = OwnerId.schema.parse("33333333-3333-4333-8333-333333333333");
const receptionistId = UserId.schema.parse(
  "55555555-5555-4555-8555-555555555555",
);
const veterinarianUserId = UserId.schema.parse(
  "66666666-6666-4666-8666-666666666666",
);
const requestedAt = Timestamp.schema.parse("2026-08-30T08:00:00.000Z");

const paidAppointment = (() => {
  const scheduled = Appointment.book({
    appointmentId,
    petId,
    ownerId,
    scheduledAt: Timestamp.schema.parse("2026-08-30T06:00:00.000Z"),
  });
  const checkedIn = Appointment.checkIn(
    scheduled,
    Timestamp.schema.parse("2026-08-30T06:10:00.000Z"),
  );
  const examining = Appointment.startExamination({
    occurredAt: Timestamp.schema.parse("2026-08-30T06:30:00.000Z"),
  })(
    checkedIn,
    VeterinarianId.schema.parse("44444444-4444-4444-8444-444444444444"),
  ).aggregateState;
  const awaitingPayment = Appointment.completeExamination(examining, {
    examId: ExamId.schema.parse("77777777-7777-4777-8777-777777777777"),
    now: Timestamp.schema.parse("2026-08-30T07:00:00.000Z"),
  });

  return Appointment.recordPayment(
    awaitingPayment,
    { amount: PaymentAmount.schema.parse(4_800) },
    Timestamp.schema.parse("2026-08-30T07:10:00.000Z"),
  );
})();

const candidate = {
  appointment: paidAppointment,
  ownerContact: OwnerContact.parse({ ownerId, ownerPhone: "090-0000-0000" })
    ._unsafeUnwrap(),
  needsFollowUp: true,
} as const satisfies FollowUpCandidate;

const users = [
  { kind: "Receptionist", userId: receptionistId },
  { kind: "Veterinarian", userId: veterinarianUserId },
] as const satisfies readonly User[];

const createHarness = (requestedAppointmentIds: readonly AppointmentId[] = []) => {
  const storedEvents: FollowUpRequested[] = [];
  const calls = {
    userResolver: 0,
    followUpResolver: 0,
    claimReader: 0,
    store: 0,
  };
  const useCase = RequestFollowUpUseCase.create({
    userResolver: {
      resolveById: (userId) => {
        calls.userResolver += 1;
        return okAsync(users.find((user) => user.userId === userId));
      },
    },
    followUpResolver: {
      resolveCandidates: () => {
        calls.followUpResolver += 1;
        return okAsync([candidate]);
      },
    },
    followUpRequestReader: {
      listRequestedAppointmentIds: () => {
        calls.claimReader += 1;
        return okAsync(requestedAppointmentIds);
      },
    },
    followUpRequestedStore: {
      store: (...events) => {
        calls.store += 1;
        storedEvents.push(...events);
        return okAsync(undefined);
      },
    },
    clock: { now: () => requestedAt },
  });

  return { useCase, storedEvents, calls };
};

describe("safe follow-up", () => {
  it("対象収集では連絡先を read model に残し event を先回りして作らない", () => {
    const targets = collectFollowUpTargets([candidate])._unsafeUnwrap();

    expect(targets).toHaveLength(1);
    expect(targets[0]).toMatchObject({ appointmentId, petId });
    expect(targets[0]).not.toHaveProperty("event");
    expect(JSON.stringify(targets[0])).not.toContain("090-0000-0000");
  });

  it("認可した受付担当者の依頼だけを識別子のみの event として保存する", async () => {
    const { useCase, storedEvents } = createHarness();

    const result = await useCase.run({
      actorUserId: receptionistId,
      appointmentIds: [appointmentId],
    });

    expect(result.isOk()).toBe(true);
    expect(storedEvents).toHaveLength(1);
    expect(storedEvents[0]).toMatchObject({
      kind: "FollowUpRequested",
      aggregateId: appointmentId,
      eventPayload: { appointmentId, petId },
      occurredAt: requestedAt,
      actorUserId: receptionistId,
    });
    expect(storedEvents[0]).not.toHaveProperty("ownerContact");
    expect(JSON.stringify(storedEvents[0])).not.toContain("090-0000-0000");
  });

  it("権限のない獣医師からの依頼は event を保存しない", async () => {
    const { useCase, storedEvents, calls } = createHarness();

    const result = await useCase.run({
      actorUserId: veterinarianUserId,
      appointmentIds: [appointmentId],
    });

    expect(calls).toEqual({
      userResolver: 1,
      followUpResolver: 0,
      claimReader: 0,
      store: 0,
    });
    expect(result.isErr() && result.error.kind).toBe("Unauthorized");
    expect(storedEvents).toEqual([]);
  });

  it("既に claim 済みの予約を typed conflict にして重複保存しない", async () => {
    const { useCase, storedEvents } = createHarness([appointmentId]);

    const result = await useCase.run({
      actorUserId: receptionistId,
      appointmentIds: [appointmentId],
    });

    expect(result.isErr() && result.error.kind).toBe("FollowUpRequestConflict");
    expect(storedEvents).toEqual([]);
  });
});
