import type { ResultAsync } from "neverthrow";

import type { AppointmentId } from "../appointment/appointmentId.js";

export type FollowUpRequestReader = Readonly<{
  listRequestedAppointmentIds: () => ResultAsync<
    readonly AppointmentId[],
    never
  >;
}>;
