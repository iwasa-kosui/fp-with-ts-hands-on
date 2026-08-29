import type { AppointmentId } from "../domain/appointment/index.js";
import type { VeterinarianId } from "../domain/appointment/index.js";
import { ok, type Result } from "../shared/schemaResult.js";

export type StartExaminationInput = Readonly<{
  appointmentId: AppointmentId;
  veterinarianId: VeterinarianId;
}>;

export const StartExaminationInput = {
  parse: (raw: any): Result<StartExaminationInput> =>
    ok({
      appointmentId: raw.appointmentId,
      veterinarianId: raw.veterinarianId,
    }),
} as const;
