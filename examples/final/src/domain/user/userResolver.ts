import type { ResultAsync } from "neverthrow";

import type { RepositoryError } from "../aggregate/repositoryError.js";
import type { VeterinarianId } from "../appointment/veterinarianId.js";
import type { UserEmail } from "./userEmail.js";
import type { UserId } from "./userId.js";
import type { User } from "./user.js";

export type UserByIdResolver = Readonly<{
  resolveById: (userId: UserId) => ResultAsync<User | undefined, RepositoryError>;
}>;

export type UserByEmailResolver = Readonly<{
  resolveByEmail: (email: UserEmail) => ResultAsync<User | undefined, RepositoryError>;
}>;

export type UserListResolver = Readonly<{
  resolveAll: () => ResultAsync<readonly User[], RepositoryError>;
}>;

export type VeterinarianByIdResolver = Readonly<{
  resolveById: (
    veterinarianId: VeterinarianId,
  ) => ResultAsync<VeterinarianId | undefined, RepositoryError>;
}>;
