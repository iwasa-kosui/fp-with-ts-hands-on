import type { Result } from "neverthrow";

import type { CheckedIn, InExamination } from "../../../src/domain/appointment/index.js";
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
    ).andThen((appointment) => {
      const started = transitionToInExamination(
        appointment as CheckedIn,
        input.veterinarianId,
        input.examinationStartedAt,
      );
      deps.store.save(started);
      return ensureCheckedIn(appointment).map(() => started);
    });
