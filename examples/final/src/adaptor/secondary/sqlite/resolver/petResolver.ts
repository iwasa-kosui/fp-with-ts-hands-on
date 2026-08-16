import { eq } from "drizzle-orm";
import { ResultAsync } from "neverthrow";

import { Pet } from "../../../../domain/pet/pet.js";
import type {
  PetByIdResolver,
  PetByOwnerIdResolver,
  PetListResolver,
} from "../../../../domain/pet/petResolver.js";
import type { SqliteDatabase } from "../db.js";
import { petsTable } from "../schema.js";

const parseRow = (row: typeof petsTable.$inferSelect) => Pet.schema.parse(row);
export const createPetByIdResolver = (db: SqliteDatabase): PetByIdResolver => ({
  resolveById: (petId) =>
    ResultAsync.fromSafePromise(
      Promise.resolve().then(() => {
        const row = db.select().from(petsTable).where(eq(petsTable.petId, petId)).get();
        return row === undefined ? undefined : parseRow(row);
      }),
    ),
});

export const createPetByOwnerIdResolver = (db: SqliteDatabase): PetByOwnerIdResolver => ({
  resolveByOwnerId: (ownerId) =>
    ResultAsync.fromSafePromise(
      Promise.resolve().then(() =>
        db.select().from(petsTable).where(eq(petsTable.ownerId, ownerId)).all().map(parseRow),
      ),
    ),
});

export const createPetListResolver = (db: SqliteDatabase): PetListResolver => ({
  resolveAll: () =>
    ResultAsync.fromSafePromise(
      Promise.resolve().then(() => db.select().from(petsTable).all().map(parseRow)),
    ),
});
