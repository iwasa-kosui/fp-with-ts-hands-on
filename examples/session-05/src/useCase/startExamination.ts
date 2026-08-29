import type { InExamination } from "../domain/appointment/appointment.js";
import { startExamination as transitionToInExamination } from "../domain/appointment/transitions.js";
import type { AppointmentId } from "../domain/ids/appointmentId.js";
import type { VeterinarianId } from "../domain/ids/veterinarianId.js";
import type { Dependencies } from "./dependencies.js";
import { ensureAppointmentFound, ensureCheckedIn } from "./errors.js";

export type StartExaminationInput = Readonly<{
  appointmentId: AppointmentId;
  veterinarianId: VeterinarianId;
  examinationStartedAt: string;
}>;

export const startExamination =
  (deps: Dependencies) =>
  (input: StartExaminationInput): InExamination => {
    const appointment = ensureAppointmentFound(
      deps.resolver.resolveById(input.appointmentId),
      input.appointmentId,
    );
    const checkedIn = ensureCheckedIn(appointment);
    const next = transitionToInExamination(
      checkedIn,
      input.veterinarianId,
      input.examinationStartedAt,
    );

    deps.store.save(next);
    return next;
  };
