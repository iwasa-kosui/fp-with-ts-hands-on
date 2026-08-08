import type { ResultAsync } from "neverthrow";

import type { RepositoryError } from "../aggregate/repositoryError.js";
import type { Appointment } from "./appointment.js";
import type { AppointmentId } from "./appointmentId.js";
import type { PetId } from "../pet/petId.js";

export type AppointmentResolver = Readonly<{
  resolveById: (
    appointmentId: AppointmentId,
  ) => ResultAsync<Appointment | undefined, RepositoryError>;
}>;

export type AppointmentByPetResolver = Readonly<{
  resolveByPetId: (
    petId: PetId,
  ) => ResultAsync<readonly Appointment[], RepositoryError>;
}>;
