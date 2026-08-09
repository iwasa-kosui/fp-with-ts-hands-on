import { describe, expect, test } from "vitest";

import { EventId } from "../../src/domain/aggregate/eventId.js";
import type { EventContext } from "../../src/domain/aggregate/eventContext.js";
import { Timestamp } from "../../src/domain/aggregate/timestamp.js";
import { VeterinarianId } from "../../src/domain/appointment/veterinarianId.js";
import { SessionTokenHash } from "../../src/domain/session/sessionTokenHash.js";
import { SessionTokenPlaintext } from "../../src/domain/session/sessionTokenPlaintext.js";
import { Permission } from "../../src/domain/user/permission.js";
import { PasswordHash } from "../../src/domain/user/passwordHash.js";
import { PlaintextPassword } from "../../src/domain/user/plaintextPassword.js";
import { User, type User as UserState } from "../../src/domain/user/user.js";
import { UserEmail } from "../../src/domain/user/userEmail.js";
import { UserId } from "../../src/domain/user/userId.js";
import { UserName } from "../../src/domain/user/userName.js";

// @ts-expect-error 任意のユーザーイベントを作る generic factory は公開しません。
import { UserEvent } from "../../src/domain/user/userEvent.js";
// @ts-expect-error 任意のセッションイベントを作る generic factory は公開しません。
import { SessionEvent } from "../../src/domain/session/sessionEvent.js";

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
const passwordHash = PasswordHash.schema.parse(
  `scrypt$${"A".repeat(22)}==$${"A".repeat(86)}==`,
);

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

const predeclaredAdminWithVeterinarianId = {
  kind: "Admin",
  userId,
  email,
  name,
  passwordHash,
  veterinarianId,
} as const;

// @ts-expect-error Admin は veterinarianId を持てません。
const invalidAdmin: UserState = predeclaredAdminWithVeterinarianId;

const predeclaredReceptionistWithVeterinarianId = {
  kind: "Receptionist",
  userId,
  email,
  name,
  passwordHash,
  veterinarianId,
} as const;

// @ts-expect-error Receptionist は veterinarianId を持てません。
const invalidReceptionist: UserState = predeclaredReceptionistWithVeterinarianId;

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
    expect(JSON.stringify(event)).not.toContain(passwordHash.unwrap());
  });

  test("evaluates permissions from the user role", () => {
    expect(Permission.canManageUsers(admin)).toBe(true);
    expect(Permission.canManageUsers(receptionist)).toBe(false);
    expect(Permission.canStartExamination(veterinarian)).toBe(true);
    expect(Permission.canStartExamination(receptionist)).toBe(false);
  });

  test("rejects password hashes that are not bounded scrypt records", () => {
    const malformed = `scrypt$${"A".repeat(23)}==$${"A".repeat(86)}==`;

    expect(PasswordHash.parse(malformed).isErr()).toBe(true);
  });

  test("keeps sensitive identity and credential values nominally distinct", () => {
    const plaintextPassword = PlaintextPassword.schema.parse(
      "correct horse battery staple",
    );
    const tokenPlaintext = SessionTokenPlaintext.schema.parse("a".repeat(64));
    const tokenHash = SessionTokenHash.schema.parse("b".repeat(64));
    const acceptsEmail = (_value: typeof email): void => undefined;
    const acceptsPasswordHash = (_value: typeof passwordHash): void => undefined;
    const acceptsPlaintextPassword = (_value: typeof plaintextPassword): void => undefined;

    if (false) {
      // @ts-expect-error UserName cannot satisfy UserEmail.
      acceptsEmail(name);
      // @ts-expect-error SessionTokenHash cannot satisfy PasswordHash.
      acceptsPasswordHash(tokenHash);
      // @ts-expect-error SessionTokenPlaintext cannot satisfy PlaintextPassword.
      acceptsPlaintextPassword(tokenPlaintext);
    }

    expect(plaintextPassword.unwrap()).not.toBe(tokenPlaintext.unwrap());
  });
});
