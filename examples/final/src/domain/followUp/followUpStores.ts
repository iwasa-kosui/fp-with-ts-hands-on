import type { ResultAsync } from "neverthrow";
import type { RepositoryError } from "../aggregate/repositoryError.js";
import type { AppointmentId } from "../appointment/appointmentId.js";
import type { FollowUpRequested } from "./followUpRequested.js";

export type FollowUpRequestConflict = Readonly<{
  kind: "FollowUpRequestConflict";
  appointmentId: AppointmentId;
}>;
export type FollowUpStoreError = RepositoryError | FollowUpRequestConflict;
export type FollowUpRequestedStore = Readonly<{
  store: (...events: readonly FollowUpRequested[]) => ResultAsync<void, FollowUpStoreError>;
}>;
