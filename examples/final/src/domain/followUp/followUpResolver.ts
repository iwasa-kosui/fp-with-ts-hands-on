import type { ResultAsync } from "neverthrow";

import type { FollowUpCandidate } from "./followUpCandidate.js";

export type FollowUpResolver = Readonly<{
  resolveCandidates: () => ResultAsync<readonly FollowUpCandidate[], never>;
}>;
