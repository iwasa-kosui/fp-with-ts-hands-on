import type { EventContext } from "../aggregate/eventContext.js";
import type { VeterinarianId } from "../ids/veterinarianId.js";
import type {
  CancellationReason,
  Canceled,
  CheckedIn,
  InExamination,
  Paid,
  RecordPaymentInput,
  Scheduled,
} from "./appointment.js";
import type { ExaminationStarted } from "./examinationStarted.js";

export const checkIn = (appointment: Scheduled, checkedInAt: string): CheckedIn =>
  ({ ...appointment, kind: "CheckedIn", checkedInAt }) as const satisfies CheckedIn;

export const startExamination = (
  appointment: CheckedIn,
  veterinarianId: VeterinarianId,
  examinationStartedAt: string,
): InExamination =>
  ({
    ...appointment,
    kind: "InExamination",
    veterinarianId,
    examinationStartedAt,
  }) as const satisfies InExamination;

export const recordPayment = (
  appointment: InExamination,
  input: RecordPaymentInput,
  paidAt: string,
): Paid =>
  ({ ...appointment, ...input, kind: "Paid", paidAt }) as const satisfies Paid;

export const cancel = (
  appointment: Scheduled | CheckedIn,
  reason: CancellationReason,
  canceledAt: string,
): Canceled =>
  ({
    kind: "Canceled",
    appointmentId: appointment.appointmentId,
    petId: appointment.petId,
    ownerId: appointment.ownerId,
    scheduledAt: appointment.scheduledAt,
    reason,
    canceledAt,
  }) as const satisfies Canceled;

export const Appointment = {
  startExamination:
    (context: EventContext) =>
    (appointment: CheckedIn, veterinarianId: VeterinarianId): ExaminationStarted => {
      const aggregateState = startExamination(
        appointment,
        veterinarianId,
        context.occurredAt,
      );

      return {
        kind: "ExaminationStarted",
        eventId: context.eventId,
        occurredAt: context.occurredAt,
        appointmentId: aggregateState.appointmentId,
        aggregateState,
      } as const satisfies ExaminationStarted;
    },
} as const;
