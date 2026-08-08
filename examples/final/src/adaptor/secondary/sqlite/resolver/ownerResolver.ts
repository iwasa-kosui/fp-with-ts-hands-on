import { eq } from "drizzle-orm";
import { ResultAsync } from "neverthrow";

import type { RepositoryError } from "../../../../domain/aggregate/repositoryError.js";
import { Owner } from "../../../../domain/owner/owner.js";
import type { OwnerResolver } from "../../../../domain/owner/ownerResolver.js";
import type { SqliteDatabase } from "../db.js";
import { ownersTable } from "../schema.js";

const parseRow = (row: typeof ownersTable.$inferSelect) => Owner.schema.parse(row);
const repositoryError = (operation: string) => (cause: unknown): RepositoryError => ({
  kind: "RepositoryError",
  operation,
  cause,
});

export const createOwnerResolver = (db: SqliteDatabase): OwnerResolver => ({
  resolveById: (ownerId) =>
    ResultAsync.fromPromise(
      Promise.resolve().then(() => {
        const row = db.select().from(ownersTable).where(eq(ownersTable.ownerId, ownerId)).get();
        return row === undefined ? undefined : parseRow(row);
      }),
      repositoryError("OwnerResolver.resolveById"),
    ),
  resolveAll: () =>
    ResultAsync.fromPromise(
      Promise.resolve().then(() => db.select().from(ownersTable).all().map(parseRow)),
      repositoryError("OwnerResolver.resolveAll"),
    ),
});
