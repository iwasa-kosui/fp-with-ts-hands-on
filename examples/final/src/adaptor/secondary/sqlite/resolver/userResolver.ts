import { eq } from "drizzle-orm";
import { ResultAsync } from "neverthrow";
import { z } from "zod";

import type { RepositoryError } from "../../../../domain/aggregate/repositoryError.js";
import type { UserResolver } from "../../../../domain/user/userResolver.js";
import { PasswordHash } from "../../../../domain/user/passwordHash.js";
import { UserEmail } from "../../../../domain/user/userEmail.js";
import { UserId } from "../../../../domain/user/userId.js";
import { UserName } from "../../../../domain/user/userName.js";
import { VeterinarianId } from "../../../../domain/appointment/veterinarianId.js";
import type { User } from "../../../../domain/user/user.js";
import type { SqliteDatabase } from "../db.js";
import { usersTable } from "../schema.js";

const BaseUserRowSchema = z.object({
  userId: UserId.schema,
  email: UserEmail.schema,
  name: UserName.schema,
  passwordHash: PasswordHash.schema,
});

const parseRow = (row: typeof usersTable.$inferSelect): User => {
  const base = BaseUserRowSchema.parse(row);
  switch (row.role) {
    case "Admin":
      if (row.veterinarianId !== null) {
        throw new TypeError("Admin must not have a veterinarian id");
      }
      return { kind: "Admin", ...base };
    case "Receptionist":
      if (row.veterinarianId !== null) {
        throw new TypeError("Receptionist must not have a veterinarian id");
      }
      return { kind: "Receptionist", ...base };
    case "Veterinarian":
      return {
        kind: "Veterinarian",
        ...base,
        veterinarianId: VeterinarianId.schema.parse(row.veterinarianId),
      };
    default:
      return row.role satisfies never;
  }
};

const repositoryError = (operation: string) => (cause: unknown): RepositoryError => ({
  kind: "RepositoryError",
  operation,
  cause,
});

export const createUserResolver = (db: SqliteDatabase): UserResolver => ({
  resolveById: (userId) =>
    ResultAsync.fromPromise(
      Promise.resolve().then(() => {
        const row = db.select().from(usersTable).where(eq(usersTable.userId, userId)).get();
        return row === undefined ? undefined : parseRow(row);
      }),
      repositoryError("UserResolver.resolveById"),
    ),
  resolveByEmail: (email) =>
    ResultAsync.fromPromise(
      Promise.resolve().then(() => {
        const row = db.select().from(usersTable).where(eq(usersTable.email, email.unwrap())).get();
        return row === undefined ? undefined : parseRow(row);
      }),
      repositoryError("UserResolver.resolveByEmail"),
    ),
  resolveAll: () =>
    ResultAsync.fromPromise(
      Promise.resolve().then(() => db.select().from(usersTable).all().map(parseRow)),
      repositoryError("UserResolver.resolveAll"),
    ),
});
