import type { ResultAsync } from "neverthrow";

import type { RepositoryError } from "../../domain/aggregate/repositoryError.js";
import type { Timestamp } from "../../domain/aggregate/timestamp.js";
import type { Appointment } from "../../domain/appointment/appointment.js";
import type { AppointmentId } from "../../domain/appointment/appointmentId.js";
import type { AppointmentVersion } from "../../domain/appointment/appointmentVersion.js";
import type { BookingKind } from "../../domain/appointment/bookingKind.js";
import type { BusinessDate, BusinessDateRange } from "../../domain/appointment/businessDate.js";
import type { ReceptionNote } from "../../domain/appointment/receptionNote.js";
import type { ServiceCode } from "../../domain/appointment/serviceCode.js";
import type { SettlementState } from "../../domain/appointment/settlementState.js";
import type { VeterinarianId } from "../../domain/appointment/veterinarianId.js";
import type { User } from "../../domain/user/user.js";

export type ReceptionPrimaryAction = "CheckIn" | "StartExamination" | "OpenDetails" | "Settle";

export type ReceptionBoardRow = Readonly<{
  appointmentId: AppointmentId;
  version: AppointmentVersion;
  bookingKind: BookingKind;
  scheduledAt: Timestamp;
  checkedInAt: Timestamp | null;
  waitingMinutes: number | null;
  ownerName: string;
  petName: string;
  receptionNote: string | null;
  serviceCode: ServiceCode;
  assignedVeterinarianName: string | null;
  appointmentStatus: Appointment["kind"];
  settlementStatus: SettlementState["kind"];
  primaryAction: ReceptionPrimaryAction;
}>;

export type ReceptionBoard = Readonly<{
  businessDate: BusinessDate;
  loadedAt: Timestamp;
  scheduled: readonly ReceptionBoardRow[];
  checkedIn: readonly ReceptionBoardRow[];
  inExamination: readonly ReceptionBoardRow[];
  awaitingPayment: readonly ReceptionBoardRow[];
  paid: readonly ReceptionBoardRow[];
  canceled: readonly ReceptionBoardRow[];
}>;

export type ReceptionBoardReaderRow = Readonly<
  Omit<ReceptionBoardRow, "primaryAction" | "receptionNote"> & {
    receptionNote: ReceptionNote | null;
    assignedVeterinarianId: VeterinarianId | null;
    statusSortAt: Timestamp;
  }
>;

export type ReceptionBoardReader = Readonly<{
  list: (
    actor: User,
    range: BusinessDateRange,
    loadedAt: Timestamp,
  ) => ResultAsync<readonly ReceptionBoardReaderRow[], RepositoryError>;
}>;
