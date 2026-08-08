import type { ResultAsync } from "neverthrow";

import type { RepositoryError } from "../aggregate/repositoryError.js";
import type { FollowUpCandidate } from "./followUpCandidate.js";

export type FollowUpResolver = Readonly<{
  resolveCandidates: () => ResultAsync<readonly FollowUpCandidate[], RepositoryError>;
}>;
