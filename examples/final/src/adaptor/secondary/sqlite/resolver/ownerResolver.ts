import { eq } from "drizzle-orm";
import { ResultAsync } from "neverthrow";

import { Owner } from "../../../../domain/owner/index.js";
import type { OwnerByIdResolver, OwnerListResolver } from "../../../../domain/owner/index.js";
import type { SqliteDatabase } from "../db.js";
import { ownersTable } from "../schema.js";

const parseRow = (row: typeof ownersTable.$inferSelect) => Owner.schema.parse(row);
export const createOwnerByIdResolver = (db: SqliteDatabase): OwnerByIdResolver => ({
  resolveById: (ownerId) =>
    ResultAsync.fromSafePromise(
      Promise.resolve().then(() => {
        const row = db.select().from(ownersTable).where(eq(ownersTable.ownerId, ownerId)).get();
        return row === undefined ? undefined : parseRow(row);
      }),
    ),
});

export const createOwnerListResolver = (db: SqliteDatabase): OwnerListResolver => ({
  resolveAll: () =>
    ResultAsync.fromSafePromise(
      Promise.resolve().then(() => db.select().from(ownersTable).all().map(parseRow)),
    ),
});
