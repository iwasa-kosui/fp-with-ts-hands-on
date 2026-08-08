import { eq } from "drizzle-orm";
import { ResultAsync } from "neverthrow";

import type { RepositoryError } from "../../../../domain/aggregate/repositoryError.js";
import { Pet } from "../../../../domain/pet/pet.js";
import type { PetResolver } from "../../../../domain/pet/petResolver.js";
import type { SqliteDatabase } from "../db.js";
import { petsTable } from "../schema.js";

const parseRow = (row: typeof petsTable.$inferSelect) => Pet.schema.parse(row);
const repositoryError = (operation: string) => (cause: unknown): RepositoryError => ({
  kind: "RepositoryError",
  operation,
  cause,
});

export const createPetResolver = (db: SqliteDatabase): PetResolver => ({
  resolveById: (petId) =>
    ResultAsync.fromPromise(
      Promise.resolve().then(() => {
        const row = db.select().from(petsTable).where(eq(petsTable.petId, petId)).get();
        return row === undefined ? undefined : parseRow(row);
      }),
      repositoryError("PetResolver.resolveById"),
    ),
  resolveByOwnerId: (ownerId) =>
    ResultAsync.fromPromise(
      Promise.resolve().then(() =>
        db.select().from(petsTable).where(eq(petsTable.ownerId, ownerId)).all().map(parseRow),
      ),
      repositoryError("PetResolver.resolveByOwnerId"),
    ),
  resolveAll: () =>
    ResultAsync.fromPromise(
      Promise.resolve().then(() => db.select().from(petsTable).all().map(parseRow)),
      repositoryError("PetResolver.resolveAll"),
    ),
});
