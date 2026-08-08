import type { ResultAsync } from "neverthrow";

import type { RepositoryError } from "../../domain/aggregate/repositoryError.js";
import type { AppointmentId } from "../../domain/appointment/appointmentId.js";

export type FollowUpRequestReader = Readonly<{
  listRequestedAppointmentIds: () => ResultAsync<
    readonly AppointmentId[],
    RepositoryError
  >;
}>;
