import { err, ok, type Result } from "neverthrow";

import type { InExamination } from "../domain/appointment/appointment.js";
import type { AppointmentId } from "../domain/ids/appointmentId.js";
import type { VeterinarianId } from "../domain/ids/veterinarianId.js";
import type { Dependencies } from "./dependencies.js";
import type { StartExaminationError } from "./errors.js";

export type StartExaminationInput = Readonly<{
  appointmentId: AppointmentId;
  veterinarianId: VeterinarianId;
  examinationStartedAt: string;
}>;

export const startExamination =
  (deps: Dependencies) =>
  (input: StartExaminationInput): Result<InExamination, StartExaminationError> => {
    const appointment = deps.resolver.resolveById(input.appointmentId);

    try {
      if (appointment === undefined) {
        throw new Error("Appointment not found");
      }
      if (appointment.kind !== "CheckedIn") {
        throw new Error(`Invalid appointment state: ${appointment.kind}`);
      }

      const next = deps.transition(
        appointment,
        input.veterinarianId,
        input.examinationStartedAt,
      );
      deps.store.save(next);
      return ok(next);
    } catch {
      return err({
        kind: "InvalidAppointmentState",
        actual: appointment?.kind ?? "Scheduled",
      });
    }
  };
