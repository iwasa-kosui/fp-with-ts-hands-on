import type { AppointmentId } from "../../../src/domain/appointment/index.js";
import type { VeterinarianId } from "../../../src/domain/appointment/index.js";
import { ok, type Result } from "../../../src/domain/shared/schemaResult.js";

export type StartExaminationInput = Readonly<{
  appointmentId: AppointmentId;
  veterinarianId: VeterinarianId;
}>;

export const StartExaminationInput = {
  parse: (raw: unknown): Result<StartExaminationInput> =>
    ok(raw as StartExaminationInput),
} as const;
