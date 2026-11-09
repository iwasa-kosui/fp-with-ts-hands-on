// このファイルを書き換えて、隣の人の仕組みをすり抜ける悪い変更を作ります
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
      .map((appointment) => {
        deps.store.save(appointment);
        return appointment;
      });
