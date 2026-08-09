import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

import { createSqliteDatabase, migrateDatabase } from "../../src/adaptor/secondary/sqlite/db.js";
import { createSensitiveAuditPayloadDisclosure } from "../../src/adaptor/secondary/sqlite/query/sensitiveAuditPayloadDisclosure.js";
import {
  domainEventPayloadsTable,
  domainEventSensitivePayloadsTable,
  domainEventsTable,
} from "../../src/adaptor/secondary/sqlite/schema.js";
import { createSensitiveAuditPayloadViewed } from "../../src/domain/aggregate/auditEvent.js";
import { EventId } from "../../src/domain/aggregate/eventId.js";
import { Timestamp } from "../../src/domain/aggregate/timestamp.js";
import { UserId } from "../../src/domain/user/userId.js";

const actorUserId = UserId.schema.parse(
  "82000000-0000-4000-8000-000000000001",
);
const targetEventId = EventId.schema.parse(
  "82000000-0000-4000-8000-000000000002",
);
const viewedEventId = EventId.schema.parse(
  "82000000-0000-4000-8000-000000000003",
);
const viewedAt = Timestamp.schema.parse("2026-08-10T01:02:03.000Z");
const sensitivePayload = {
  eventId: targetEventId,
  aggregateState: {
    ownerName: "個人情報を含む状態",
    nested: { html: "</pre><script>alert('xss')</script>" },
  },
  eventPayload: { diagnosis: "機微な診断" },
} as const;

const insertTarget = (
  db: ReturnType<typeof createSqliteDatabase>,
  sensitivity: "Regular" | "Sensitive" = "Sensitive",
): void => {
  db.insert(domainEventsTable).values({
    eventId: targetEventId,
    aggregateId: "appointment-private",
    aggregateName: "Appointment",
    eventName: "appointment.final-settlement-recorded",
    occurredAt: "2026-08-10T00:00:00.000Z",
    actorUserId,
    payloadSensitivity: sensitivity,
  }).run();
  db.insert(
    sensitivity === "Sensitive"
      ? domainEventSensitivePayloadsTable
      : domainEventPayloadsTable,
  ).values(sensitivePayload).run();
};

const viewedEvent = (eventId = viewedEventId) =>
  createSensitiveAuditPayloadViewed(
    { eventId, occurredAt: viewedAt, actorUserId },
    targetEventId,
  );

describe("SQLite SensitiveAuditPayloadDisclosure", () => {
  test("機微本文のreadと本文を含まないRegular閲覧イベントを一つのtransactionでcommitする", async () => {
    const db = createSqliteDatabase(":memory:");
    migrateDatabase(db);
    insertTarget(db);

    const result = await createSensitiveAuditPayloadDisclosure(db)
      .revealAndRecord(targetEventId, viewedEvent());

    expect(result._unsafeUnwrap()).toEqual({
      aggregateState: sensitivePayload.aggregateState,
      eventPayload: sensitivePayload.eventPayload,
    });
    expect(
      db.select().from(domainEventsTable)
        .where(eq(domainEventsTable.eventId, viewedEventId)).get(),
    ).toEqual({
      eventId: viewedEventId,
      aggregateId: targetEventId,
      aggregateName: "Audit",
      eventName: "audit.sensitive-payload-viewed",
      occurredAt: viewedAt,
      actorUserId,
      payloadSensitivity: "Regular",
    });
    expect(
      db.select().from(domainEventPayloadsTable)
        .where(eq(domainEventPayloadsTable.eventId, viewedEventId)).get(),
    ).toEqual({
      eventId: viewedEventId,
      aggregateState: null,
      eventPayload: {
        targetEventId,
        viewerUserId: actorUserId,
        viewedAt,
      },
    });
    expect(
      db.select().from(domainEventSensitivePayloadsTable)
        .where(eq(domainEventSensitivePayloadsTable.eventId, viewedEventId)).get(),
    ).toBeUndefined();
    expect(
      JSON.stringify(
        db.select().from(domainEventPayloadsTable)
          .where(eq(domainEventPayloadsTable.eventId, viewedEventId)).get(),
      ),
    ).not.toContain("機微な診断");
  });

  test("存在しないeventをtyped errorで拒否して閲覧イベントを残さない", async () => {
    const db = createSqliteDatabase(":memory:");
    migrateDatabase(db);

    const result = await createSensitiveAuditPayloadDisclosure(db)
      .revealAndRecord(targetEventId, viewedEvent());

    expect(result._unsafeUnwrapErr()).toEqual({
      kind: "AuditEventNotFound",
      eventId: targetEventId,
    });
    expect(db.select().from(domainEventsTable).all()).toEqual([]);
  });

  test("Regular eventをtyped errorで拒否して本文を返さず監査も増やさない", async () => {
    const db = createSqliteDatabase(":memory:");
    migrateDatabase(db);
    insertTarget(db, "Regular");

    const result = await createSensitiveAuditPayloadDisclosure(db)
      .revealAndRecord(targetEventId, viewedEvent());

    expect(result._unsafeUnwrapErr()).toEqual({
      kind: "AuditPayloadNotSensitive",
      eventId: targetEventId,
    });
    expect(db.select().from(domainEventsTable).all()).toHaveLength(1);
  });

  test("閲覧event ID重複で監査insertが失敗したら本文を返さず全変更をrollbackする", async () => {
    const db = createSqliteDatabase(":memory:");
    migrateDatabase(db);
    insertTarget(db);
    const before = {
      metadata: db.select().from(domainEventsTable).all(),
      regular: db.select().from(domainEventPayloadsTable).all(),
      sensitive: db.select().from(domainEventSensitivePayloadsTable).all(),
    };

    const result = await createSensitiveAuditPayloadDisclosure(db)
      .revealAndRecord(targetEventId, viewedEvent(targetEventId));

    expect(result._unsafeUnwrapErr()).toMatchObject({
      kind: "RepositoryError",
      operation: "SensitiveAuditPayloadDisclosure.revealAndRecord",
    });
    expect({
      metadata: db.select().from(domainEventsTable).all(),
      regular: db.select().from(domainEventPayloadsTable).all(),
      sensitive: db.select().from(domainEventSensitivePayloadsTable).all(),
    }).toEqual(before);
  });

  test("同じ閲覧event IDの並行開示は一方だけcommitし、競合側へ本文を返さない", async () => {
    const db = createSqliteDatabase(":memory:");
    migrateDatabase(db);
    insertTarget(db);
    const disclosure = createSensitiveAuditPayloadDisclosure(db);

    const results = await Promise.all([
      disclosure.revealAndRecord(targetEventId, viewedEvent()),
      disclosure.revealAndRecord(targetEventId, viewedEvent()),
    ]);

    expect(results.filter((result) => result.isOk())).toHaveLength(1);
    expect(results.filter((result) => result.isErr())).toHaveLength(1);
    expect(results.find((result) => result.isErr())?._unsafeUnwrapErr())
      .toMatchObject({
        kind: "RepositoryError",
        operation: "SensitiveAuditPayloadDisclosure.revealAndRecord",
      });
    expect(
      db.select().from(domainEventsTable)
        .where(eq(domainEventsTable.eventName, "audit.sensitive-payload-viewed"))
        .all(),
    ).toHaveLength(1);
    expect(
      db.select().from(domainEventPayloadsTable)
        .where(eq(domainEventPayloadsTable.eventId, viewedEventId)).all(),
    ).toHaveLength(1);
  });

  test("Sensitive metadataの本文rowが欠損していたら本文を返さず監査も増やさない", async () => {
    const db = createSqliteDatabase(":memory:");
    migrateDatabase(db);
    db.insert(domainEventsTable).values({
      eventId: targetEventId,
      aggregateId: "appointment-private",
      aggregateName: "Appointment",
      eventName: "appointment.final-settlement-recorded",
      occurredAt: "2026-08-10T00:00:00.000Z",
      actorUserId,
      payloadSensitivity: "Sensitive",
    }).run();

    const result = await createSensitiveAuditPayloadDisclosure(db)
      .revealAndRecord(targetEventId, viewedEvent());

    expect(result._unsafeUnwrapErr()).toMatchObject({
      kind: "RepositoryError",
      operation: "SensitiveAuditPayloadDisclosure.revealAndRecord",
    });
    expect(db.select().from(domainEventsTable).all()).toHaveLength(1);
    expect(db.select().from(domainEventPayloadsTable).all()).toEqual([]);
  });
});
