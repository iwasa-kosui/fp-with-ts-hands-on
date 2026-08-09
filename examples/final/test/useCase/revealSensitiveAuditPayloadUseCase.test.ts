import { errAsync, okAsync } from "neverthrow";
import { describe, expect, test } from "vitest";

import type { SensitiveAuditPayloadViewed } from "../../src/domain/aggregate/auditEvent.js";
import { EventId } from "../../src/domain/aggregate/eventId.js";
import { Timestamp } from "../../src/domain/aggregate/timestamp.js";
import { VeterinarianId } from "../../src/domain/appointment/veterinarianId.js";
import { PasswordHash } from "../../src/domain/user/passwordHash.js";
import type { User } from "../../src/domain/user/user.js";
import { UserEmail } from "../../src/domain/user/userEmail.js";
import { UserId } from "../../src/domain/user/userId.js";
import { UserName } from "../../src/domain/user/userName.js";
import { RevealSensitiveAuditPayloadUseCase } from "../../src/useCase/revealSensitiveAuditPayloadUseCase.js";

const actorUserId = UserId.schema.parse(
  "81000000-0000-4000-8000-000000000001",
);
const targetEventId = EventId.schema.parse(
  "81000000-0000-4000-8000-000000000002",
);
const viewedEventId = EventId.schema.parse(
  "81000000-0000-4000-8000-000000000003",
);
const viewedAt = Timestamp.schema.parse("2026-08-10T01:02:03.000Z");
const passwordHash = PasswordHash.schema.parse(
  `scrypt$${"A".repeat(22)}==$${"B".repeat(86)}==`,
);
const baseUser = {
  userId: actorUserId,
  email: UserEmail.schema.parse("viewer@example.test"),
  name: UserName.schema.parse("監査担当者"),
  passwordHash,
} as const;
const users = {
  Admin: { kind: "Admin", ...baseUser },
  Receptionist: { kind: "Receptionist", ...baseUser },
  Veterinarian: {
    kind: "Veterinarian",
    ...baseUser,
    veterinarianId: VeterinarianId.schema.parse(
      "81000000-0000-4000-8000-000000000004",
    ),
  },
} as const satisfies Readonly<Record<User["kind"], User>>;
const sensitivePayload = {
  aggregateState: { ownerName: "個人情報を含む状態" },
  eventPayload: { diagnosis: "機微な診断" },
} as const;

describe("RevealSensitiveAuditPayloadUseCase", () => {
  test("Adminの明示開示をfreshな閲覧イベントと一度だけ原子的portへ渡す", async () => {
    let received: Readonly<{
      targetEventId: typeof targetEventId;
      viewedEvent: SensitiveAuditPayloadViewed;
    }> | undefined;
    let clockCalls = 0;
    let generatorCalls = 0;
    const useCase = RevealSensitiveAuditPayloadUseCase.create({
      userResolver: { resolveById: () => okAsync(users.Admin) },
      clock: {
        now: () => {
          clockCalls += 1;
          return viewedAt;
        },
      },
      eventIdGenerator: {
        generate: () => {
          generatorCalls += 1;
          return viewedEventId;
        },
      },
      sensitiveAuditPayloadDisclosure: {
        revealAndRecord: (eventId, viewedEvent) => {
          received = { targetEventId: eventId, viewedEvent };
          return okAsync(sensitivePayload);
        },
      },
    });

    const result = await useCase.run({ actorUserId, targetEventId });

    expect(result._unsafeUnwrap()).toEqual(sensitivePayload);
    expect(clockCalls).toBe(1);
    expect(generatorCalls).toBe(1);
    expect(received).toEqual({
      targetEventId,
      viewedEvent: {
        kind: "SensitiveAuditPayloadViewed",
        eventId: viewedEventId,
        aggregateId: targetEventId,
        aggregateName: "Audit",
        aggregateState: undefined,
        eventName: "audit.sensitive-payload-viewed",
        eventPayload: {
          targetEventId,
          viewerUserId: actorUserId,
          viewedAt,
        },
        occurredAt: viewedAt,
        actorUserId,
      },
    });
  });

  test.each(["Receptionist", "Veterinarian"] as const)(
    "%sはclock・ID生成・開示portを呼ぶ前に拒否される",
    async (role) => {
      let clockCalls = 0;
      let generatorCalls = 0;
      let disclosureCalls = 0;
      const useCase = RevealSensitiveAuditPayloadUseCase.create({
        userResolver: { resolveById: () => okAsync(users[role]) },
        clock: {
          now: () => {
            clockCalls += 1;
            return viewedAt;
          },
        },
        eventIdGenerator: {
          generate: () => {
            generatorCalls += 1;
            return viewedEventId;
          },
        },
        sensitiveAuditPayloadDisclosure: {
          revealAndRecord: () => {
            disclosureCalls += 1;
            return okAsync(sensitivePayload);
          },
        },
      });

      const result = await useCase.run({ actorUserId, targetEventId });

      expect(result._unsafeUnwrapErr()).toEqual({
        kind: "Unauthorized",
        actorUserId,
      });
      expect(clockCalls).toBe(0);
      expect(generatorCalls).toBe(0);
      expect(disclosureCalls).toBe(0);
    },
  );

  test("repository障害のcauseをuse case境界から外へ出さない", async () => {
    const privateCause = new Error("diagnosis=外へ出してはいけない");
    const useCase = RevealSensitiveAuditPayloadUseCase.create({
      userResolver: { resolveById: () => okAsync(users.Admin) },
      clock: { now: () => viewedAt },
      eventIdGenerator: { generate: () => viewedEventId },
      sensitiveAuditPayloadDisclosure: {
        revealAndRecord: () =>
          errAsync({
            kind: "RepositoryError",
            operation: "SensitiveAuditPayloadDisclosure.revealAndRecord",
            cause: privateCause,
          }),
      },
    });

    const result = await useCase.run({ actorUserId, targetEventId });

    expect(result._unsafeUnwrapErr()).toEqual({
      kind: "RepositoryError",
      operation: "SensitiveAuditPayloadDisclosure.revealAndRecord",
    });
    expect(JSON.stringify(result._unsafeUnwrapErr())).not.toContain(
      "diagnosis",
    );
  });
});
