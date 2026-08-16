import type { EventId } from "../aggregate/eventId.js";
import type { AppointmentId } from "../ids/appointmentId.js";
import type { InExamination } from "./appointment.js";

export type ExaminationStarted = Readonly<{
  kind: "ExaminationStarted";
  eventId: EventId;
  occurredAt: string;
  appointmentId: AppointmentId;
  aggregateState: InExamination;
}>;
