import type { ResultAsync } from "neverthrow";

import type { RepositoryError } from "../aggregate/repositoryError.js";
import type { UserId } from "../user/userId.js";
import type { Session } from "./session.js";
import type { SessionId } from "./sessionId.js";
import type { SessionTokenHash } from "./sessionTokenHash.js";

export type SessionByIdResolver = Readonly<{
  resolveById: (sessionId: SessionId) => ResultAsync<Session | undefined, RepositoryError>;
}>;

export type SessionByTokenHashResolver = Readonly<{
  resolveByTokenHash: (tokenHash: SessionTokenHash) => ResultAsync<Session | undefined, RepositoryError>;
}>;

export type SessionByUserIdResolver = Readonly<{
  resolveByUserId: (userId: UserId) => ResultAsync<readonly Session[], RepositoryError>;
}>;
