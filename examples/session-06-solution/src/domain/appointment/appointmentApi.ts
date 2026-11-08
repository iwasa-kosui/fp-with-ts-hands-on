import type { Appointment as AppointmentState } from "./appointment.js";
import { Appointment as appointmentTransitions } from "./transitions.js";

export type Appointment = AppointmentState;
export const Appointment = appointmentTransitions;
