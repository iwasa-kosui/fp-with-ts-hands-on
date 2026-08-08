import { describe, expect, test } from "vitest";
import { sql } from "drizzle-orm";

import { createSqliteDatabase, migrateDatabase } from "../../src/adaptor/secondary/sqlite/db.js";
import { createEventResolver } from "../../src/adaptor/secondary/sqlite/resolver/eventResolver.js";
import { createUserResolver } from "../../src/adaptor/secondary/sqlite/resolver/userResolver.js";
import { createUserEventStore } from "../../src/adaptor/secondary/sqlite/store/userEventStore.js";
import { EventId } from "../../src/domain/aggregate/eventId.js";
import { Timestamp } from "../../src/domain/aggregate/timestamp.js";
import { PasswordHash } from "../../src/domain/user/passwordHash.js";
import { User } from "../../src/domain/user/user.js";
import { UserEmail } from "../../src/domain/user/userEmail.js";
import { UserId } from "../../src/domain/user/userId.js";
import { UserName } from "../../src/domain/user/userName.js";

describe("SQLite resolvers", () => {
  test("parses persisted rows back through domain schemas", async () => {
    const db = createSqliteDatabase(":memory:");
    migrateDatabase(db);
    const userId = UserId.schema.parse("20000000-0000-4000-8000-000000000001");
    const event = User.create({
      eventId: EventId.schema.parse("20000000-0000-4000-8000-000000000002"),
      occurredAt: Timestamp.schema.parse("2026-08-08T02:00:00.000Z"),
      actorUserId: userId,
    })({
      kind: "Admin",
      userId,
      email: UserEmail.schema.parse("admin@example.test"),
      name: UserName.schema.parse("Clinic Admin"),
      passwordHash: PasswordHash.schema.parse(`scrypt$${"A".repeat(22)}==$${"B".repeat(86)}==`),
    });
    await createUserEventStore(db).store(event);

    const resolvedUser = await createUserResolver(db).resolveById(userId);
    const resolvedEvents = await createEventResolver(db).resolveAll();

    expect(resolvedUser.isOk() && resolvedUser.value?.kind).toBe("Admin");
    expect(resolvedUser.isOk() && resolvedUser.value?.email.unwrap()).toBe("admin@example.test");
    expect(resolvedEvents.isOk() && resolvedEvents.value).toHaveLength(1);
  });

  test("maps a corrupt SQLite row to RepositoryError", async () => {
    const db = createSqliteDatabase(":memory:");
    migrateDatabase(db);
    db.run(sql.raw(
      "INSERT INTO users (user_id, role, email, name, password_hash, veterinarian_id) " +
      "VALUES ('not-a-uuid', 'Admin', 'not-an-email', 'Broken', 'not-a-password-hash', NULL)",
    ));

    const result = await createUserResolver(db).resolveAll();

    expect(result.isErr()).toBe(true);
    expect(result.isErr() && result.error).toMatchObject({
      kind: "RepositoryError",
      operation: "UserResolver.resolveAll",
    });
  });
});
