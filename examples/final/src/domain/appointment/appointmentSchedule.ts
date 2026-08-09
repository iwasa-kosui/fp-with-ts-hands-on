import { Timestamp, type Timestamp as TimestampValue } from "../aggregate/timestamp.js";
import type { AppointmentDuration } from "./appointmentDuration.js";

export type AppointmentSchedule = Readonly<{
  startsAt: TimestampValue;
  durationMinutes: AppointmentDuration;
}>;

const endMilliseconds = (schedule: AppointmentSchedule): number =>
  Date.parse(schedule.startsAt) + schedule.durationMinutes * 60 * 1000;

const endsAt = (schedule: AppointmentSchedule): TimestampValue =>
  Timestamp.schema.parse(new Date(endMilliseconds(schedule)).toISOString());

const overlaps = (left: AppointmentSchedule, right: AppointmentSchedule): boolean =>
  Date.parse(left.startsAt) < endMilliseconds(right) &&
  Date.parse(right.startsAt) < endMilliseconds(left);

export const AppointmentSchedule = { endsAt, overlaps } as const;
