import type { Result } from "neverthrow";

import type { InExamination } from "../../../src/domain/appointment/index.js";
import { startExamination as transitionToInExamination } from "../../../src/domain/appointment/index.js";
import type { AppointmentId } from "../../../src/domain/appointment/index.js";
import type { VeterinarianId } from "../../../src/domain/appointment/index.js";
import type { Dependencies } from "../../../src/useCase/dependencies.js";
import {
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
  (input: StartExaminationInput): Result<InExamination, StartExaminationError> => {
    const found = deps.resolver.resolveById(input.appointmentId);
    if (found === undefined) {
      throw new Error(`Appointment not found: ${input.appointmentId}`);
    }
    return ensureCheckedIn(found)
      .map((appointment) =>
        transitionToInExamination(
          appointment,
          input.veterinarianId,
          input.examinationStartedAt,
        ),
      )
      .map((appointment) => {
        deps.store.save(appointment);
        return appointment;
      });
  };
