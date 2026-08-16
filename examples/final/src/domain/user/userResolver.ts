import type { ResultAsync } from "neverthrow";

import type { UserEmail } from "./userEmail.js";
import type { UserId } from "./userId.js";
import type { User } from "./user.js";

export type UserByIdResolver = Readonly<{
  resolveById: (userId: UserId) => ResultAsync<User | undefined, never>;
}>;

export type UserByEmailResolver = Readonly<{
  resolveByEmail: (email: UserEmail) => ResultAsync<User | undefined, never>;
}>;

export type UserListResolver = Readonly<{
  resolveAll: () => ResultAsync<readonly User[], never>;
}>;
