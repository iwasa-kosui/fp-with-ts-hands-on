import { eq } from "drizzle-orm";
import { ResultAsync } from "neverthrow";

import type { RepositoryError } from "../../../../domain/aggregate/repositoryError.js";
import { Owner } from "../../../../domain/owner/owner.js";
import type { OwnerByIdResolver, OwnerListResolver } from "../../../../domain/owner/ownerResolver.js";
import type { SqliteDatabase } from "../db.js";
import { ownersTable } from "../schema.js";

const parseRow = (row: typeof ownersTable.$inferSelect) => Owner.schema.parse(row);
const repositoryError = (operation: string) => (cause: unknown): RepositoryError => ({
  kind: "RepositoryError",
  operation,
  cause,
});

export const createOwnerByIdResolver = (db: SqliteDatabase): OwnerByIdResolver => ({
  resolveById: (ownerId) =>
    ResultAsync.fromPromise(
      Promise.resolve().then(() => {
        const row = db.select().from(ownersTable).where(eq(ownersTable.ownerId, ownerId)).get();
        return row === undefined ? undefined : parseRow(row);
      }),
      repositoryError("OwnerByIdResolver.resolveById"),
    ),
});

export const createOwnerListResolver = (db: SqliteDatabase): OwnerListResolver => ({
  resolveAll: () =>
    ResultAsync.fromPromise(
      Promise.resolve().then(() => db.select().from(ownersTable).all().map(parseRow)),
      repositoryError("OwnerListResolver.resolveAll"),
    ),
});
