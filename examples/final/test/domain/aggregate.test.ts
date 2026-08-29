import { ResultAsync } from "neverthrow";
import { inspect } from "node:util";
import { describe, expect, test } from "vitest";
import type { AggregateStore } from "../../src/domain/aggregate/aggregateStore.js";
import type { DomainEvent } from "../../src/domain/aggregate/domainEvent.js";
import { EventId } from "../../src/domain/aggregate/eventId.js";
import { Timestamp } from "../../src/domain/aggregate/timestamp.js";
import { PaymentAmount } from "../../src/domain/appointment/index.js";
import { Sensitive } from "../../src/domain/shared/sensitive.js";
import { UserId } from "../../src/domain/user/userId.js";

type ExampleDeleted = DomainEvent<
  string,
  "Example",
  Readonly<{ id: string }>,
  "ExampleDeleted",
  "example.deleted",
  Readonly<{ id: string }>
>;

describe("aggregate event contracts", () => {
  test("stores deletion events without an aggregate state and redacts sensitive values", async () => {
    const eventId = EventId.schema.parse("24e3b860-97a4-475a-aec3-fbf6e9769944");
    const occurredAt = Timestamp.schema.parse("2026-08-08T12:00:00.000Z");
    const actorUserId = UserId.schema.parse("d7c17d59-777a-4f36-819e-8f64f1d1c335");
    const deleted = {
      kind: "ExampleDeleted",
      eventId,
      aggregateId: "example-1",
      aggregateName: "Example",
      aggregateState: undefined,
      eventName: "example.deleted",
      eventPayload: { id: "example-1" },
      occurredAt,
      actorUserId,
    } as const satisfies ExampleDeleted;
    const received: ExampleDeleted[] = [];
    const store: AggregateStore<ExampleDeleted> = {
      store: (...events) => {
        received.push(...events);
        return ResultAsync.fromSafePromise(Promise.resolve());
      },
    };

    await store.store(deleted);

    expect(deleted.aggregateState).toBeUndefined();
    expect(received).toEqual([deleted]);
    expect(JSON.stringify(Sensitive.of("owner@example.test"))).toBe('"[REDACTED]"');
  });

  test("redacts Sensitive through JSON, String, and Node inspection", () => {
    const sensitive = Sensitive.of("owner@example.test");

    expect(JSON.stringify(sensitive)).toBe('"[REDACTED]"');
    expect(String(sensitive)).toBe("[REDACTED]");
    expect(inspect(sensitive)).toBe("[REDACTED]");
  });

  test("rejects invalid timestamps and non-positive or non-finite payment amounts", () => {
    expect(Timestamp.parse("not-a-timestamp").isErr()).toBe(true);
    expect(Timestamp.parse("2026-99-99T25:61:00Z").isErr()).toBe(true);

    for (const amount of [0, -1, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(PaymentAmount.parse(amount).isErr()).toBe(true);
    }
  });
});
