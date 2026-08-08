import type { VeterinarianId } from "../appointment/veterinarianId.js";
import type { EventContext } from "../aggregate/eventContext.js";
import type { PasswordHash } from "./passwordHash.js";
import { UserEvent, type UserCreated, type UserDeleted, type UserPasswordReset, type UserUpdated } from "./userEvent.js";
import type { UserEmail } from "./userEmail.js";
import type { UserId } from "./userId.js";
import type { UserName } from "./userName.js";

export type Admin = Readonly<{
  kind: "Admin";
  userId: UserId;
  email: UserEmail;
  name: UserName;
  passwordHash: PasswordHash;
}>;

export type Receptionist = Readonly<{
  kind: "Receptionist";
  userId: UserId;
  email: UserEmail;
  name: UserName;
  passwordHash: PasswordHash;
}>;

export type Veterinarian = Readonly<{
  kind: "Veterinarian";
  userId: UserId;
  email: UserEmail;
  name: UserName;
  passwordHash: PasswordHash;
  veterinarianId: VeterinarianId;
}>;

export type User = Admin | Receptionist | Veterinarian;

export type UserProfile = Readonly<{
  email: UserEmail;
  name: UserName;
}>;

const create = (context: EventContext) => (user: User): UserCreated =>
  UserEvent.create(
    context,
    user.userId,
    user,
    "UserCreated",
    "user.created",
    { userId: user.userId, role: user.kind },
  );

const update =
  (context: EventContext) =>
  (user: User, profile: UserProfile): UserUpdated => {
    const aggregateState = { ...user, ...profile } as const satisfies User;

    return UserEvent.create(
      context,
      aggregateState.userId,
      aggregateState,
      "UserUpdated",
      "user.updated",
      { userId: aggregateState.userId, role: aggregateState.kind },
    );
  };

const resetPassword =
  (context: EventContext) =>
  (user: User, passwordHash: PasswordHash): UserPasswordReset => {
    const aggregateState = { ...user, passwordHash } as const satisfies User;

    return UserEvent.create(
      context,
      aggregateState.userId,
      aggregateState,
      "UserPasswordReset",
      "user.password-reset",
      { userId: aggregateState.userId },
    );
  };

const remove = (context: EventContext) => (user: User): UserDeleted =>
  UserEvent.create(
    context,
    user.userId,
    undefined,
    "UserDeleted",
    "user.deleted",
    { userId: user.userId },
  );

export const User = {
  create,
  update,
  resetPassword,
  delete: remove,
} as const;
