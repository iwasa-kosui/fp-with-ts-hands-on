import type { ResultAsync } from "neverthrow";

import type { RepositoryError } from "../aggregate/repositoryError.js";
import type { Appointment } from "./appointment.js";
import type { AppointmentId } from "./appointmentId.js";
import type { PetId } from "../pet/petId.js";

export type AppointmentByIdResolver = Readonly<{
  resolveById: (
    appointmentId: AppointmentId,
  ) => ResultAsync<Appointment | undefined, RepositoryError>;
}>;

export type AppointmentByPetIdResolver = Readonly<{
  resolveByPetId: (
    petId: PetId,
  ) => ResultAsync<readonly Appointment[], RepositoryError>;
}>;

export type AppointmentListResolver = Readonly<{
  resolveAll: () => ResultAsync<readonly Appointment[], RepositoryError>;
}>;
