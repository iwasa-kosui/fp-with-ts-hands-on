import type { AppointmentId, VeterinarianId } from "../../../../src/domain/appointment/index.js";
import { StartExaminationInput } from "../../subjects/input.js";

declare const input: StartExaminationInput;

// @ts-expect-error
const appointmentId: AppointmentId = input.veterinarianId;

// @ts-expect-error
const veterinarianId: VeterinarianId = input.appointmentId;

export { appointmentId, veterinarianId };
