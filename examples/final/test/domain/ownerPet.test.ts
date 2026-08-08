import { describe, expect, test } from "vitest";

import { EventId } from "../../src/domain/aggregate/eventId.js";
import type { EventContext } from "../../src/domain/aggregate/eventContext.js";
import { Timestamp } from "../../src/domain/aggregate/timestamp.js";
import { ExamId } from "../../src/domain/examResult/examId.js";
import { ExamResult } from "../../src/domain/examResult/examResult.js";
import * as ExamResultEventModule from "../../src/domain/examResult/examResultEvent.js";
import { Owner } from "../../src/domain/owner/owner.js";
import { OwnerId } from "../../src/domain/owner/ownerId.js";
import * as OwnerEventModule from "../../src/domain/owner/ownerEvent.js";
import { Pet } from "../../src/domain/pet/pet.js";
import { PetId } from "../../src/domain/pet/petId.js";
import * as PetEventModule from "../../src/domain/pet/petEvent.js";
import { UserId } from "../../src/domain/user/userId.js";

const ownerId = OwnerId.schema.parse("33333333-3333-4333-8333-333333333333");
const petId = PetId.schema.parse("22222222-2222-4222-8222-222222222222");
const examId = ExamId.schema.parse("11111111-1111-4111-8111-111111111111");
const actorUserId = UserId.schema.parse("55555555-5555-4555-8555-555555555555");

const context = (eventId: string, occurredAt: string): EventContext => ({
  eventId: EventId.schema.parse(eventId),
  occurredAt: Timestamp.schema.parse(occurredAt),
  actorUserId,
});

const createdContext = context(
  "66666666-6666-4666-8666-666666666666",
  "2026-08-29T06:00:00.000Z",
);
const updatedContext = context(
  "77777777-7777-4777-8777-777777777777",
  "2026-08-29T06:30:00.000Z",
);
const deletedContext = context(
  "88888888-8888-4888-8888-888888888888",
  "2026-08-29T07:00:00.000Z",
);

describe("owner and pet aggregates", () => {
  test("exports only fixed event constructors and always omits deleted aggregate state", () => {
    const owner = Owner.parse({
      ownerId,
      name: "Owner A",
      email: "owner@example.test",
      phone: "090-0000-0000",
    })._unsafeUnwrap();
    const pet = Pet.parse({ petId, ownerId, name: "Mochi", species: "Cat" })._unsafeUnwrap();
    const result = ExamResult.parse({
      examId,
      petId,
      collectedAt: Timestamp.schema.parse("2026-08-30T06:30:00.000Z"),
      items: ["skin inflammation"],
      needsFollowUp: true,
    })._unsafeUnwrap();

    if (false) {
      // @ts-expect-error Event unions expose no generic factory.
      OwnerEventModule.create(createdContext, owner.ownerId, owner, "OwnerCreated", "owner.created");
      // @ts-expect-error Event unions expose no generic factory.
      PetEventModule.create(createdContext, pet.petId, pet.ownerId, pet, "PetCreated", "pet.created");
      // @ts-expect-error Event unions expose no generic factory.
      ExamResultEventModule.create(
        createdContext,
        result.examId,
        result.petId,
        result,
        "ExamResultRecorded",
        "exam-result.recorded",
      );
    }

    expect([
      OwnerEventModule.createOwnerDeleted(deletedContext, owner.ownerId).aggregateState,
      PetEventModule.createPetDeleted(deletedContext, pet).aggregateState,
      ExamResultEventModule.createExamResultDeleted(deletedContext, result).aggregateState,
    ]).toEqual([undefined, undefined, undefined]);
  });

  test("wraps owner PII at the parsing boundary", () => {
    const parsed = Owner.parse({
      ownerId,
      name: "Owner A",
      email: "owner@example.test",
      phone: "090-0000-0000",
    });

    expect(parsed.isOk()).toBe(true);
    expect(JSON.stringify(parsed._unsafeUnwrap())).not.toContain("Owner A");
    expect(JSON.stringify(parsed._unsafeUnwrap())).not.toContain("owner@example.test");
    expect(JSON.stringify(parsed._unsafeUnwrap())).not.toContain("090-0000-0000");
  });

  test("creates, updates, and physically deletes an owner through events without PII payloads", () => {
    const owner = Owner.parse({
      ownerId,
      name: "Owner A",
      email: "owner@example.test",
      phone: "090-0000-0000",
    })._unsafeUnwrap();
    const created = Owner.create(createdContext)(owner);
    const profile = Owner.parse({
      ownerId,
      name: "Owner B",
      email: "owner-b@example.test",
      phone: "080-0000-0000",
    })._unsafeUnwrap();
    const updated = Owner.update(updatedContext)(created.aggregateState, profile);
    const deleted = Owner.delete(deletedContext)(updated.aggregateState);

    expect(created).toMatchObject({
      kind: "OwnerCreated",
      aggregateId: ownerId,
      aggregateName: "Owner",
      aggregateState: owner,
      eventName: "owner.created",
      eventPayload: { ownerId },
    });
    expect(updated).toMatchObject({
      kind: "OwnerUpdated",
      aggregateId: ownerId,
      aggregateState: profile,
      eventName: "owner.updated",
      eventPayload: { ownerId },
    });
    expect(deleted).toEqual({
      kind: "OwnerDeleted",
      eventId: deletedContext.eventId,
      aggregateId: ownerId,
      aggregateName: "Owner",
      aggregateState: undefined,
      eventName: "owner.deleted",
      eventPayload: { ownerId },
      occurredAt: deletedContext.occurredAt,
      actorUserId,
    });
    expect(JSON.stringify([created.eventPayload, updated.eventPayload, deleted.eventPayload])).not.toContain(
      "owner@example.test",
    );
  });

  test("creates, updates, and physically deletes a pet with only identifiers in payloads", () => {
    const pet = Pet.parse({ petId, ownerId, name: "Mochi", species: "Cat" })._unsafeUnwrap();
    const created = Pet.create(createdContext)(pet);
    const updated = Pet.update(updatedContext)(created.aggregateState, {
      name: "Mochi Jr.",
      species: "Cat",
    });
    const deleted = Pet.delete(deletedContext)(updated.aggregateState);

    expect(created).toMatchObject({
      kind: "PetCreated",
      aggregateId: petId,
      aggregateName: "Pet",
      aggregateState: pet,
      eventName: "pet.created",
      eventPayload: { petId, ownerId },
    });
    expect(updated).toMatchObject({
      kind: "PetUpdated",
      aggregateId: petId,
      aggregateState: { petId, ownerId, name: "Mochi Jr.", species: "Cat" },
      eventName: "pet.updated",
      eventPayload: { petId, ownerId },
    });
    expect(deleted.aggregateState).toBeUndefined();
    expect(deleted.eventPayload).toEqual({ petId, ownerId });
    expect(JSON.stringify([created.eventPayload, updated.eventPayload, deleted.eventPayload])).not.toContain(
      "Mochi",
    );
  });

  test("keeps an examination result attached to its pet and redacts clinical items", () => {
    const result = ExamResult.parse({
      examId,
      petId,
      collectedAt: Timestamp.schema.parse("2026-08-30T06:30:00.000Z"),
      items: ["skin inflammation"],
      needsFollowUp: true,
    })._unsafeUnwrap();
    const recorded = ExamResult.create(createdContext)(result);
    const changedResult = ExamResult.parse({
      examId,
      petId,
      collectedAt: result.collectedAt,
      items: ["condition improving"],
      needsFollowUp: false,
    })._unsafeUnwrap();
    const updated = ExamResult.update(updatedContext)(recorded.aggregateState, {
      items: changedResult.items,
      needsFollowUp: changedResult.needsFollowUp,
    });
    const deleted = ExamResult.delete(deletedContext)(updated.aggregateState);

    expect(recorded.aggregateState.petId).toBe(petId);
    expect(recorded.eventPayload).toEqual({ examId, petId });
    expect(JSON.stringify(recorded.aggregateState)).not.toContain("skin inflammation");
    expect(updated.eventPayload).toEqual({ examId, petId });
    expect(deleted.aggregateState).toBeUndefined();
    expect(deleted.eventPayload).toEqual({ examId, petId });
  });
});
