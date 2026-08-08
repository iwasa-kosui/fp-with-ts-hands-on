import { describe, expect, test } from "vitest";

import { EventId } from "../../src/domain/aggregate/eventId.js";
import type { EventContext } from "../../src/domain/aggregate/eventContext.js";
import { Timestamp } from "../../src/domain/aggregate/timestamp.js";
import { VeterinarianId } from "../../src/domain/appointment/veterinarianId.js";
import { Permission } from "../../src/domain/user/permission.js";
import { PasswordHash } from "../../src/domain/user/passwordHash.js";
import { User, type User as UserState } from "../../src/domain/user/user.js";
import { UserEmail } from "../../src/domain/user/userEmail.js";
import { UserId } from "../../src/domain/user/userId.js";
import { UserName } from "../../src/domain/user/userName.js";

const userId = UserId.schema.parse("11111111-1111-4111-8111-111111111111");
const veterinarianId = VeterinarianId.schema.parse(
  "22222222-2222-4222-8222-222222222222",
);
const actorUserId = UserId.schema.parse("33333333-3333-4333-8333-333333333333");
const context: EventContext = {
  eventId: EventId.schema.parse("44444444-4444-4444-8444-444444444444"),
  occurredAt: Timestamp.schema.parse("2026-08-08T00:00:00.000Z"),
  actorUserId,
};
const email = UserEmail.schema.parse("vet@example.test");
const name = UserName.schema.parse("Dr. Aki");
const passwordHash = PasswordHash.schema.parse("salt:derived-key");

const admin = {
  kind: "Admin",
  userId,
  email,
  name,
  passwordHash,
} as const satisfies UserState;
const receptionist = {
  kind: "Receptionist",
  userId,
  email,
  name,
  passwordHash,
} as const satisfies UserState;
const veterinarian = {
  kind: "Veterinarian",
  userId,
  email,
  name,
  passwordHash,
  veterinarianId,
} as const satisfies UserState;

// @ts-expect-error Veterinarian には veterinarianId が必要です。
const invalidVeterinarian: UserState = {
  kind: "Veterinarian",
  userId,
  email,
  name,
  passwordHash,
};

describe("user aggregate", () => {
  test("creates an event with the resulting role-discriminated user state", () => {
    const event = User.create(context)(veterinarian);

    expect(event).toMatchObject({
      kind: "UserCreated",
      aggregateId: userId,
      aggregateName: "User",
      aggregateState: veterinarian,
      eventName: "user.created",
      eventPayload: { userId, role: "Veterinarian" },
      occurredAt: context.occurredAt,
      actorUserId,
    });
    expect(JSON.stringify(event)).not.toContain("vet@example.test");
    expect(JSON.stringify(event)).not.toContain("salt:derived-key");
  });

  test("evaluates permissions from the user role", () => {
    expect(Permission.canManageUsers(admin)).toBe(true);
    expect(Permission.canManageUsers(receptionist)).toBe(false);
    expect(Permission.canStartExamination(veterinarian)).toBe(true);
    expect(Permission.canStartExamination(receptionist)).toBe(false);
  });
});
