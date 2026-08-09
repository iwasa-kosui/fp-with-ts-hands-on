import type { ResultAsync } from "neverthrow";

import type { RepositoryError } from "../../domain/aggregate/repositoryError.js";
import type { Timestamp } from "../../domain/aggregate/timestamp.js";
import type { Appointment, } from "../../domain/appointment/appointment.js";
import type { AppointmentDuration } from "../../domain/appointment/appointmentDuration.js";
import type { AppointmentId } from "../../domain/appointment/appointmentId.js";
import type { ServiceCode } from "../../domain/appointment/serviceCode.js";
import type { SettlementState } from "../../domain/appointment/settlementState.js";
import type { VeterinarianId } from "../../domain/appointment/veterinarianId.js";
import type { User } from "../../domain/user/user.js";

export type AppointmentCalendarItem = Readonly<{
  appointmentId: AppointmentId;
  startsAt: Timestamp;
  endsAt: Timestamp;
  durationMinutes: AppointmentDuration;
  petName: string;
  serviceCode: ServiceCode;
  bookingKind: "Reserved" | "WalkIn";
  assignedVeterinarianId: VeterinarianId | null;
  assignedVeterinarianName: string | null;
  appointmentStatus: Appointment["kind"];
  settlementStatus: SettlementState["kind"];
}>;

export type AppointmentCalendarReader = Readonly<{
  list: (
    actor: User,
    range: Readonly<{ startsAt: Timestamp; endsAt: Timestamp }>,
  ) => ResultAsync<readonly AppointmentCalendarItem[], RepositoryError>;
}>;
