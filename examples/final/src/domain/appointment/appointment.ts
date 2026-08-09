import type { Timestamp } from "../aggregate/timestamp.js";
import { err, ok, type Result } from "neverthrow";
import type { OwnerId } from "../owner/ownerId.js";
import type { PetId } from "../pet/petId.js";
import type { EventContext } from "../aggregate/eventContext.js";
import {
  AppointmentEvent,
  type AppointmentBooked,
  type AppointmentCanceled,
  type AppointmentCheckedIn,
  type AppointmentExaminationCompleted,
  type AppointmentDepositReceived,
  type AppointmentFinalSettlementRecorded,
  type AppointmentReceptionNoteUpdated,
  type ExaminationStarted,
  type AppointmentUpdated,
  type AppointmentWalkInRegistered,
  type AppointmentVeterinarianReassigned,
} from "./appointmentEvent.js";
import type { ExamId } from "../examResult/examId.js";
import type { AppointmentId } from "./appointmentId.js";
import type { PaymentAmount } from "./paymentAmount.js";
import type { VeterinarianId } from "./veterinarianId.js";
import type { AppointmentReason } from "./appointmentReason.js";
import { AppointmentDuration, type AppointmentDuration as AppointmentDurationValue } from "./appointmentDuration.js";
import { AppointmentVersion, type AppointmentVersion as AppointmentVersionValue } from "./appointmentVersion.js";
import type { BookingKind } from "./bookingKind.js";
import type { CancellationReason } from "./cancellationReason.js";
import type { Diagnosis } from "./diagnosis.js";
import type { ReceptionNote } from "./receptionNote.js";
import { ServiceCode, type ServiceCode as ServiceCodeValue } from "./serviceCode.js";
import {
  Settlement,
  type DepositReceived,
  type DepositRefunded,
  type NoPayment,
  type Settled,
} from "./settlementState.js";
import type { Treatment } from "./treatment.js";
import { SettlementAdjustmentAmount } from "./settlementAdjustmentAmount.js";

export type AppointmentBase = Readonly<{
  appointmentId: AppointmentId;
  petId: PetId;
  ownerId: OwnerId;
  scheduledAt: Timestamp;
  durationMinutes: AppointmentDurationValue;
  serviceCode: ServiceCodeValue;
  bookingKind: BookingKind;
  assignedVeterinarianId: VeterinarianId | null;
  visitReason: AppointmentReason;
  receptionNote: ReceptionNote | null;
  settlement: NoPayment | DepositReceived;
  version: AppointmentVersionValue;
}>;

export type Scheduled = AppointmentBase & Readonly<{
  kind: "Scheduled";
}>;

export type CheckedIn = AppointmentBase & Readonly<{
  kind: "CheckedIn";
  checkedInAt: Timestamp;
}>;

export type InExamination = Omit<AppointmentBase, "assignedVeterinarianId"> & Readonly<{
  kind: "InExamination";
  checkedInAt: Timestamp;
  assignedVeterinarianId: VeterinarianId;
  examinationStartedAt: Timestamp;
}>;

export type AwaitingPayment = Omit<AppointmentBase, "assignedVeterinarianId"> & Readonly<{
  kind: "AwaitingPayment";
  checkedInAt: Timestamp;
  assignedVeterinarianId: VeterinarianId;
  examinationStartedAt: Timestamp;
  examId: ExamId;
  examinationCompletedAt: Timestamp;
}>;

export type Paid = Omit<AppointmentBase, "assignedVeterinarianId" | "settlement"> & Readonly<{
  kind: "Paid";
  checkedInAt: Timestamp;
  assignedVeterinarianId: VeterinarianId;
  examinationStartedAt: Timestamp;
  examId: ExamId;
  examinationCompletedAt: Timestamp;
  diagnosis: Diagnosis;
  treatment: Treatment;
  settlement: Settled;
}>;

export type Canceled = Omit<AppointmentBase, "settlement"> & Readonly<{
  kind: "Canceled";
  settlement: NoPayment | DepositRefunded;
  cancellationReason: CancellationReason;
  canceledAt: Timestamp;
}>;

export type Appointment =
  Scheduled | CheckedIn | InExamination | AwaitingPayment | Paid | Canceled;
type OperationalBookAppointmentInput = Readonly<Omit<Scheduled, "kind" | "version">>;
type LegacyBookAppointmentInput = Readonly<{
  appointmentId: AppointmentId;
  petId: PetId;
  ownerId: OwnerId;
  scheduledAt: Timestamp;
  reason: AppointmentReason;
}>;
export type BookAppointmentInput =
  | OperationalBookAppointmentInput
  | LegacyBookAppointmentInput;
export type CompleteExaminationInput = Readonly<{ examId: ExamId }>;
export type RecordPaymentInput = Readonly<{
  diagnosis: Diagnosis;
  treatment: Treatment;
  amount: PaymentAmount;
}>;
export type SettleAppointmentInput = Readonly<{
  diagnosis: Diagnosis;
  treatment: Treatment;
  finalAmount: PaymentAmount;
}>;
export type DepositNotAllowed = Readonly<{
  kind: "DepositNotAllowed";
  appointmentId: AppointmentId;
}>;
export type DepositAlreadyReceived = Readonly<{
  kind: "DepositAlreadyReceived";
  appointmentId: AppointmentId;
}>;
export type InvalidDepositAppointmentState = Readonly<{
  kind: "InvalidDepositAppointmentState";
  appointmentId: AppointmentId;
  actualKind: Exclude<Appointment["kind"], "Scheduled" | "CheckedIn">;
}>;
export type DepositRuleError =
  | DepositNotAllowed
  | DepositAlreadyReceived
  | InvalidDepositAppointmentState;
export type UpdateAppointmentInput = Readonly<{
  ownerId: OwnerId;
  petId: PetId;
  scheduledAt: Timestamp;
  durationMinutes: AppointmentDurationValue;
  serviceCode: ServiceCodeValue;
  assignedVeterinarianId: VeterinarianId | null;
  visitReason: AppointmentReason;
}>;
export type RegisterWalkInInput = Readonly<{
  appointmentId: AppointmentId;
  ownerId: OwnerId;
  petId: PetId;
  durationMinutes: AppointmentDurationValue;
  serviceCode: ServiceCodeValue;
  assignedVeterinarianId: VeterinarianId | null;
  visitReason: AppointmentReason;
  receptionNote: ReceptionNote | null;
}>;
const book =
  (context: EventContext) =>
  (input: BookAppointmentInput): AppointmentBooked => {
    const aggregateState = {
      kind: "Scheduled",
      appointmentId: input.appointmentId,
      petId: input.petId,
      ownerId: input.ownerId,
      scheduledAt: input.scheduledAt,
      durationMinutes: "durationMinutes" in input
        ? input.durationMinutes
        : AppointmentDuration.schema.parse(30),
      serviceCode: "serviceCode" in input
        ? input.serviceCode
        : ServiceCode.schema.parse("GeneralConsultation"),
      bookingKind: "bookingKind" in input ? input.bookingKind : "Reserved",
      assignedVeterinarianId: "assignedVeterinarianId" in input
        ? input.assignedVeterinarianId
        : null,
      visitReason: "visitReason" in input ? input.visitReason : input.reason,
      receptionNote: "receptionNote" in input ? input.receptionNote : null,
      settlement: "settlement" in input ? input.settlement : { kind: "NoPayment" },
      version: AppointmentVersion.schema.parse(1),
    } as const satisfies Scheduled;

    return AppointmentEvent.create(
      context,
      aggregateState.appointmentId,
      aggregateState,
      "AppointmentBooked",
      "appointment.booked",
      { appointmentId: aggregateState.appointmentId },
    );
  };

const nextVersion = (version: AppointmentVersionValue): AppointmentVersionValue =>
  AppointmentVersion.schema.parse(version + 1);

const update =
  (context: EventContext) =>
  (scheduled: Scheduled, input: UpdateAppointmentInput): AppointmentUpdated => {
    const aggregateState = {
      ...scheduled,
      ...input,
      version: nextVersion(scheduled.version),
    } as const satisfies Scheduled;

    return AppointmentEvent.create(
      context,
      aggregateState.appointmentId,
      aggregateState,
      "AppointmentUpdated",
      "appointment.updated",
      { appointmentId: aggregateState.appointmentId },
    );
  };

const registerWalkIn =
  (context: EventContext) =>
  (input: RegisterWalkInInput): AppointmentWalkInRegistered => {
    const aggregateState = {
      kind: "CheckedIn",
      ...input,
      scheduledAt: context.occurredAt,
      checkedInAt: context.occurredAt,
      bookingKind: "WalkIn",
      settlement: { kind: "NoPayment" },
      version: AppointmentVersion.schema.parse(1),
    } as const satisfies CheckedIn;

    return AppointmentEvent.create(
      context,
      aggregateState.appointmentId,
      aggregateState,
      "AppointmentWalkInRegistered",
      "appointment.walk-in-registered",
      { appointmentId: aggregateState.appointmentId },
    );
  };

const reassignVeterinarian =
  (context: EventContext) =>
  (
    appointment: Scheduled | CheckedIn,
    veterinarianId: VeterinarianId | null,
  ): AppointmentVeterinarianReassigned => {
    const aggregateState = {
      ...appointment,
      assignedVeterinarianId: veterinarianId,
      version: nextVersion(appointment.version),
    } satisfies Scheduled | CheckedIn;

    return AppointmentEvent.create(
      context,
      aggregateState.appointmentId,
      aggregateState,
      "AppointmentVeterinarianReassigned",
      "appointment.veterinarian-reassigned",
      { appointmentId: aggregateState.appointmentId, veterinarianId },
    );
  };

type ReceptionNoteUpdatable =
  | Scheduled
  | CheckedIn
  | InExamination
  | AwaitingPayment;

const updateReceptionNote =
  (context: EventContext) =>
  (
    appointment: ReceptionNoteUpdatable,
    receptionNote: ReceptionNote | null,
  ): AppointmentReceptionNoteUpdated => {
    const aggregateState = {
      ...appointment,
      receptionNote,
      version: nextVersion(appointment.version),
    } as const satisfies ReceptionNoteUpdatable;

    return AppointmentEvent.create(
      context,
      aggregateState.appointmentId,
      aggregateState,
      "AppointmentReceptionNoteUpdated",
      "appointment.reception-note-updated",
      { appointmentId: aggregateState.appointmentId },
    );
  };

const receiveDeposit =
  (context: EventContext) =>
  (
    appointment: Appointment,
    depositAmount: PaymentAmount,
  ): Result<AppointmentDepositReceived, DepositRuleError> => {
    if (appointment.serviceCode !== "Vaccination") {
      return err({
        kind: "DepositNotAllowed",
        appointmentId: appointment.appointmentId,
      });
    }
    if (appointment.kind !== "Scheduled" && appointment.kind !== "CheckedIn") {
      return err({
        kind: "InvalidDepositAppointmentState",
        appointmentId: appointment.appointmentId,
        actualKind: appointment.kind,
      });
    }
    if (appointment.settlement.kind === "DepositReceived") {
      return err({
        kind: "DepositAlreadyReceived",
        appointmentId: appointment.appointmentId,
      });
    }
    const aggregateState = {
      ...appointment,
      settlement: {
        kind: "DepositReceived",
        depositAmount,
        receivedAt: context.occurredAt,
      },
      version: nextVersion(appointment.version),
    } as const satisfies Scheduled | CheckedIn;

    return ok(AppointmentEvent.create(
      context,
      aggregateState.appointmentId,
      aggregateState,
      "AppointmentDepositReceived",
      "appointment.deposit-received",
      { appointmentId: aggregateState.appointmentId, depositAmount },
    ));
  };

const checkIn =
  (context: EventContext) =>
  (scheduled: Scheduled): AppointmentCheckedIn => {
    const aggregateState = {
      ...scheduled,
      kind: "CheckedIn",
      checkedInAt: context.occurredAt,
      version: nextVersion(scheduled.version),
    } as const satisfies CheckedIn;

    return AppointmentEvent.create(
      context,
      aggregateState.appointmentId,
      aggregateState,
      "AppointmentCheckedIn",
      "appointment.checked-in",
      { appointmentId: aggregateState.appointmentId },
    );
  };

const startExamination =
  (context: EventContext) =>
  (
    checkedIn: CheckedIn,
    veterinarianId: VeterinarianId,
  ): ExaminationStarted => {
    const aggregateState = {
      ...checkedIn,
      kind: "InExamination",
      assignedVeterinarianId: veterinarianId,
      examinationStartedAt: context.occurredAt,
      version: nextVersion(checkedIn.version),
    } as const satisfies InExamination;

    return AppointmentEvent.create(
      context,
      aggregateState.appointmentId,
      aggregateState,
      "ExaminationStarted",
      "appointment.examination-started",
      { appointmentId: aggregateState.appointmentId, veterinarianId },
    );
  };

const settle =
  (context: EventContext) =>
  (
    awaitingPayment: AwaitingPayment,
    input: SettleAppointmentInput,
  ): AppointmentFinalSettlementRecorded => {
    const aggregateState = {
      ...awaitingPayment,
      kind: "Paid",
      diagnosis: input.diagnosis,
      treatment: input.treatment,
      settlement: Settlement.settle(
        awaitingPayment.settlement,
        input.finalAmount,
        context.occurredAt,
      ),
      version: nextVersion(awaitingPayment.version),
    } as const satisfies Paid;

    return AppointmentEvent.create(
      context,
      aggregateState.appointmentId,
      aggregateState,
      "AppointmentFinalSettlementRecorded",
      "appointment.final-settlement-recorded",
      { appointmentId: aggregateState.appointmentId },
    );
  };

const recordPayment =
  (context: EventContext) =>
  (awaitingPayment: AwaitingPayment, input: RecordPaymentInput) =>
    settle(context)(awaitingPayment, {
      diagnosis: input.diagnosis,
      treatment: input.treatment,
      finalAmount: input.amount,
    });

const completeExamination =
  (context: EventContext) =>
  (
    examining: InExamination,
    input: CompleteExaminationInput,
  ): AppointmentExaminationCompleted => {
    const aggregateState = {
      ...examining,
      kind: "AwaitingPayment",
      examId: input.examId,
      examinationCompletedAt: context.occurredAt,
      version: nextVersion(examining.version),
    } as const satisfies AwaitingPayment;

    return AppointmentEvent.create(
      context,
      aggregateState.appointmentId,
      aggregateState,
      "AppointmentExaminationCompleted",
      "appointment.examination-completed",
      { appointmentId: aggregateState.appointmentId, examId: input.examId },
    );
  };

const cancel =
  (context: EventContext) =>
  (
    appointment: Scheduled | CheckedIn,
    reason: CancellationReason,
  ): AppointmentCanceled => {
    const refundAmount = SettlementAdjustmentAmount.schema.parse(
      appointment.settlement.kind === "DepositReceived"
        ? appointment.settlement.depositAmount
        : 0,
    );
    const aggregateState = {
      ...appointment,
      kind: "Canceled",
      settlement: appointment.settlement.kind === "DepositReceived"
        ? {
            kind: "DepositRefunded",
            depositAmount: appointment.settlement.depositAmount,
            refundedAt: context.occurredAt,
          }
        : appointment.settlement,
      cancellationReason: reason,
      canceledAt: context.occurredAt,
      version: nextVersion(appointment.version),
    } as const satisfies Canceled;

    return AppointmentEvent.create(
      context,
      aggregateState.appointmentId,
      aggregateState,
      "AppointmentCanceled",
      "appointment.canceled",
      { appointmentId: aggregateState.appointmentId, refundAmount },
    );
  };

export const Appointment = {
  book,
  update,
  registerWalkIn,
  reassignVeterinarian,
  updateReceptionNote,
  receiveDeposit,
  checkIn,
  startExamination,
  completeExamination,
  recordPayment,
  settle,
  cancel,
  isActive: (appointment: Appointment) =>
    appointment.kind === "Scheduled" ||
    appointment.kind === "CheckedIn" ||
    appointment.kind === "InExamination" ||
    appointment.kind === "AwaitingPayment",
} as const;
