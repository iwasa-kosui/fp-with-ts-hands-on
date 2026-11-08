import { StartExaminationInput } from "../../../s03/exercises/guard/subjects/input.js";

export const parseIds = (appointmentId: string, veterinarianId: string) =>
  StartExaminationInput.parse({ appointmentId, veterinarianId });
