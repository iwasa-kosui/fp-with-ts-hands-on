import type { ResultAsync } from "neverthrow";

import type { RepositoryError } from "../aggregate/repositoryError.js";
import type { UserEmail } from "./userEmail.js";
import type { UserId } from "./userId.js";
import type { User } from "./user.js";

export type UserResolver = Readonly<{
  resolveById: (userId: UserId) => ResultAsync<User | undefined, RepositoryError>;
  resolveByEmail: (email: UserEmail) => ResultAsync<User | undefined, RepositoryError>;
  resolveAll: () => ResultAsync<readonly User[], RepositoryError>;
}>;
