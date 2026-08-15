import type { Result } from "neverthrow";

import type { InExamination } from "../domain/appointment/appointment.js";
import type { AppointmentId } from "../domain/ids/appointmentId.js";
import type { VeterinarianId } from "../domain/ids/veterinarianId.js";
import {
  ensureAppointmentFound,
  ensureCheckedIn,
  type StartExaminationError,
} from "./errors.js";
import type { ResultDependencies } from "./resultDependencies.js";

export type StartExaminationInput = Readonly<{
  appointmentId: AppointmentId;
  veterinarianId: VeterinarianId;
  examinationStartedAt: string;
}>;

export const startExamination =
  (deps: ResultDependencies) =>
  (input: StartExaminationInput): Result<InExamination, StartExaminationError> =>
    ensureAppointmentFound(
      deps.resolver.resolveById(input.appointmentId),
      input.appointmentId,
    )
      .andThen(ensureCheckedIn)
      .map((appointment) =>
        deps.transition(
          appointment,
          input.veterinarianId,
          input.examinationStartedAt,
        ),
      )
      .map((appointment) => {
        deps.store.save(appointment);
        return appointment;
      });
