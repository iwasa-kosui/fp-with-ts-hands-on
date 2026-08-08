import { describe, expect, test } from "vitest";

import {
  createSqliteDatabase,
  migrateDatabase,
} from "../../src/adaptor/secondary/sqlite/db.js";
import {
  createAppointmentByIdResolver,
  createAppointmentByPetIdResolver,
  createAppointmentListResolver,
} from "../../src/adaptor/secondary/sqlite/resolver/appointmentResolver.js";
import {
  createExamResultByIdResolver,
  createExamResultByPetIdResolver,
} from "../../src/adaptor/secondary/sqlite/resolver/examResultResolver.js";
import { createEventHistoryReader } from "../../src/adaptor/secondary/sqlite/query/eventHistoryReader.js";
import { createFollowUpRequestReader } from "../../src/adaptor/secondary/sqlite/query/followUpRequestReader.js";
import { createInstallationStatusQuery } from "../../src/adaptor/secondary/sqlite/query/installationStatusQuery.js";
import { createFollowUpResolver } from "../../src/adaptor/secondary/sqlite/resolver/followUpResolver.js";
import {
  createOwnerByIdResolver,
  createOwnerListResolver,
} from "../../src/adaptor/secondary/sqlite/resolver/ownerResolver.js";
import {
  createPetByIdResolver,
  createPetByOwnerIdResolver,
  createPetListResolver,
} from "../../src/adaptor/secondary/sqlite/resolver/petResolver.js";
import {
  createSessionByIdResolver,
  createSessionByTokenHashResolver,
  createSessionByUserIdResolver,
} from "../../src/adaptor/secondary/sqlite/resolver/sessionResolver.js";
import {
  createUserByEmailResolver,
  createUserByIdResolver,
  createUserListResolver,
} from "../../src/adaptor/secondary/sqlite/resolver/userResolver.js";

describe("public SQLite resolver architecture", () => {
  test("every public resolver object exposes exactly one resolve method", () => {
    const db = createSqliteDatabase(":memory:");
    migrateDatabase(db);
    const resolvers = [
      createUserByIdResolver(db),
      createUserByEmailResolver(db),
      createUserListResolver(db),
      createSessionByIdResolver(db),
      createSessionByTokenHashResolver(db),
      createSessionByUserIdResolver(db),
      createOwnerByIdResolver(db),
      createOwnerListResolver(db),
      createPetByIdResolver(db),
      createPetByOwnerIdResolver(db),
      createPetListResolver(db),
      createAppointmentByIdResolver(db),
      createAppointmentByPetIdResolver(db),
      createAppointmentListResolver(db),
      createExamResultByIdResolver(db),
      createExamResultByPetIdResolver(db),
      createFollowUpResolver(db),
    ];

    expect(resolvers.map((resolver) => Object.keys(resolver))).toEqual([
      ["resolveById"],
      ["resolveByEmail"],
      ["resolveAll"],
      ["resolveById"],
      ["resolveByTokenHash"],
      ["resolveByUserId"],
      ["resolveById"],
      ["resolveAll"],
      ["resolveById"],
      ["resolveByOwnerId"],
      ["resolveAll"],
      ["resolveById"],
      ["resolveByPetId"],
      ["resolveAll"],
      ["resolveById"],
      ["resolveByPetId"],
      ["resolveCandidates"],
    ]);
  });

  test("exposes each query as a one-method reader", () => {
    const db = createSqliteDatabase(":memory:");
    migrateDatabase(db);

    expect(Object.keys(createEventHistoryReader(db))).toEqual(["list"]);
    expect(Object.keys(createFollowUpRequestReader(db))).toEqual([
      "listRequestedAppointmentIds",
    ]);
    expect(Object.keys(createInstallationStatusQuery(db))).toEqual(["get"]);
  });
});
