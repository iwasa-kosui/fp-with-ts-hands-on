import { err, ok } from "neverthrow";
import type { Result } from "neverthrow";

import type { InExamination } from "../../../src/domain/appointment/index.js";
import { startExamination as transitionToInExamination } from "../../../src/domain/appointment/index.js";
import type { AppointmentId } from "../../../src/domain/appointment/index.js";
import type { VeterinarianId } from "../../../src/domain/appointment/index.js";
import type { Dependencies } from "../../../src/useCase/dependencies.js";
import {
  ensureAppointmentFound,
  ensureCheckedIn,
  type StartExaminationError,
} from "../../../src/useCase/errors.js";

export type StartExaminationInput = Readonly<{
  appointmentId: AppointmentId;
  veterinarianId: VeterinarianId;
  examinationStartedAt: string;
}>;

export const startExamination =
  (deps: Dependencies) =>
  (input: StartExaminationInput): Result<InExamination, StartExaminationError> =>
    ensureAppointmentFound(
      deps.resolver.resolveById(input.appointmentId),
      input.appointmentId,
    )
      .andThen(ensureCheckedIn)
      .map((appointment) =>
        transitionToInExamination(
          appointment,
          input.veterinarianId,
          input.examinationStartedAt,
        ),
      )
      .andThen((appointment) => {
        try {
          deps.store.save(appointment);
          return ok(appointment);
        } catch {
          return err({
            kind: "AppointmentNotFound",
            appointmentId: input.appointmentId,
          } as const);
        }
      });
