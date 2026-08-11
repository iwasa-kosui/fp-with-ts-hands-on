import { expect, it } from "vitest";

import { AppointmentId } from "../src/domain/appointmentId.js";
import type { FollowUpRequested } from "../src/domain/followUp/followUpRequested.js";
import { PetId } from "../src/domain/petId.js";
import { Timestamp } from "../src/domain/timestamp.js";
import { UserId } from "../src/domain/user/userId.js";

const appointmentId = AppointmentId.schema.parse(
  "11111111-1111-4111-8111-111111111111",
);
const petId = PetId.schema.parse("22222222-2222-4222-8222-222222222222");
const occurredAt = Timestamp.schema.parse("2026-08-30T08:00:00.000Z");
const actorUserId = UserId.schema.parse(
  "55555555-5555-4555-8555-555555555555",
);
const event = {
  kind: "FollowUpRequested",
  aggregateId: appointmentId,
  eventPayload: { appointmentId, petId },
  occurredAt,
  actorUserId,
} as const satisfies FollowUpRequested;

it("follow-up event は発生日時と操作者を必須にする", () => {
  if (false) {
    // @ts-expect-error occurredAt is required for an event fact.
    const withoutOccurredAt: FollowUpRequested = {
      kind: "FollowUpRequested",
      aggregateId: appointmentId,
      eventPayload: { appointmentId, petId },
      actorUserId,
    };
    // @ts-expect-error actorUserId is required for an event fact.
    const withoutActor: FollowUpRequested = {
      kind: "FollowUpRequested",
      aggregateId: appointmentId,
      eventPayload: { appointmentId, petId },
      occurredAt,
    };
    void withoutOccurredAt;
    void withoutActor;
  }

  expect(event).toMatchObject({ occurredAt, actorUserId });
});
