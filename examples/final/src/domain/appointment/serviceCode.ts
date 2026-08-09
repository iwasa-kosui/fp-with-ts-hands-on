import { z } from "zod";

import type { AppointmentDuration } from "./appointmentDuration.js";
import { schemaResult } from "../shared/schemaResult.js";

const ServiceCodeSchema = z.enum([
  "GeneralConsultation",
  "FollowUpVisit",
  "Vaccination",
  "ExaminationOrProcedure",
]);

export type ServiceCode = z.infer<typeof ServiceCodeSchema>;

const defaultDurations = {
  GeneralConsultation: 30,
  FollowUpVisit: 15,
  Vaccination: 15,
  ExaminationOrProcedure: 60,
} as const satisfies Readonly<Record<ServiceCode, AppointmentDuration>>;

export const ServiceCode = {
  schema: ServiceCodeSchema,
  parse: schemaResult(ServiceCodeSchema),
} as const;

export const ServiceMenu = {
  defaultDuration: (serviceCode: ServiceCode): AppointmentDuration => defaultDurations[serviceCode],
} as const;
