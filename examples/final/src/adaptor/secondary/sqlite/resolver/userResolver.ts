import { eq } from "drizzle-orm";
import { ResultAsync } from "neverthrow";
import { z } from "zod";

import type {
  UserByEmailResolver,
  UserByIdResolver,
  UserListResolver,
} from "../../../../domain/user/userResolver.js";
import { PasswordHash } from "../../../../domain/user/passwordHash.js";
import { UserEmail } from "../../../../domain/user/userEmail.js";
import { UserId } from "../../../../domain/user/userId.js";
import { UserName } from "../../../../domain/user/userName.js";
import { VeterinarianId } from "../../../../domain/appointment/veterinarianId.js";
import type { User } from "../../../../domain/user/user.js";
import { assertNever } from "../../../../domain/shared/assertNever.js";
import type { SqliteDatabase } from "../db.js";
import { usersTable } from "../schema.js";

const BaseUserRowSchema = z.object({
  userId: UserId.schema,
  email: UserEmail.schema,
  name: UserName.schema,
  passwordHash: PasswordHash.schema,
});
const UserRoleSchema = z.enum(["Admin", "Receptionist", "Veterinarian"]);

const parseRow = (row: typeof usersTable.$inferSelect): User => {
  const base = BaseUserRowSchema.parse(row);
  const role = UserRoleSchema.parse(row.role);
  switch (role) {
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
      return assertNever(role);
  }
};

export const createUserByIdResolver = (db: SqliteDatabase): UserByIdResolver => ({
  resolveById: (userId) =>
    ResultAsync.fromSafePromise(
      Promise.resolve().then(() => {
        const row = db.select().from(usersTable).where(eq(usersTable.userId, userId)).get();
        return row === undefined ? undefined : parseRow(row);
      }),
    ),
});

export const createUserByEmailResolver = (db: SqliteDatabase): UserByEmailResolver => ({
  resolveByEmail: (email) =>
    ResultAsync.fromSafePromise(
      Promise.resolve().then(() => {
        const row = db.select().from(usersTable).where(eq(usersTable.email, email.unwrap())).get();
        return row === undefined ? undefined : parseRow(row);
      }),
    ),
});

export const createUserListResolver = (db: SqliteDatabase): UserListResolver => ({
  resolveAll: () =>
    ResultAsync.fromSafePromise(
      Promise.resolve().then(() => db.select().from(usersTable).all().map(parseRow)),
    ),
});
