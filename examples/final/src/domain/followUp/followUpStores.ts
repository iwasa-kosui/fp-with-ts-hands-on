import type { ResultAsync } from "neverthrow";
import type { AppointmentId } from "../appointment/index.js";
import type { FollowUpRequested } from "./followUpRequested.js";

export type FollowUpRequestConflict = Readonly<{
  kind: "FollowUpRequestConflict";
  appointmentId: AppointmentId;
}>;
export type FollowUpStoreError = FollowUpRequestConflict;
export type FollowUpRequestedStore = Readonly<{
  store: (...events: readonly FollowUpRequested[]) => ResultAsync<void, FollowUpStoreError>;
}>;
