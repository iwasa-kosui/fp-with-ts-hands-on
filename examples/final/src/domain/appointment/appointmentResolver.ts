import type { ResultAsync } from "neverthrow";

import type { Appointment } from "./appointment.js";
import type { AppointmentId } from "./appointmentId.js";
import type { PetId } from "../pet/petId.js";

export type AppointmentByIdResolver = Readonly<{
  resolveById: (
    appointmentId: AppointmentId,
  ) => ResultAsync<Appointment | undefined, never>;
}>;

export type AppointmentByPetIdResolver = Readonly<{
  resolveByPetId: (
    petId: PetId,
  ) => ResultAsync<readonly Appointment[], never>;
}>;

export type AppointmentListResolver = Readonly<{
  resolveAll: () => ResultAsync<readonly Appointment[], never>;
}>;
