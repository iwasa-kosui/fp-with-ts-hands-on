import type { ResultAsync } from "neverthrow";

import type { RepositoryError } from "../aggregate/repositoryError.js";
import type { UserId } from "../user/userId.js";
import type { Session } from "./session.js";
import type { SessionId } from "./sessionId.js";
import type { SessionTokenHash } from "./sessionTokenHash.js";

export type SessionResolver = Readonly<{
  resolveById: (sessionId: SessionId) => ResultAsync<Session | undefined, RepositoryError>;
  resolveByTokenHash: (tokenHash: SessionTokenHash) => ResultAsync<Session | undefined, RepositoryError>;
  resolveByUserId: (userId: UserId) => ResultAsync<readonly Session[], RepositoryError>;
}>;
