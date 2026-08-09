import { Timestamp } from "../../../../domain/aggregate/timestamp.js";

const localDateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const jstOffsetMilliseconds = 9 * 60 * 60 * 1_000;

export const toLocalAppointmentDateTime = (timestamp: string): string | null => {
  const parsed = Timestamp.canonicalSchema.safeParse(timestamp);
  if (!parsed.success) return null;
  const jstWallClock = new Date(Date.parse(parsed.data) + jstOffsetMilliseconds);
  return Number.isFinite(jstWallClock.valueOf())
    ? jstWallClock.toISOString().slice(0, 16)
    : null;
};

export const toAppointmentTimestamp = (localDateTime: string): string | null => {
  if (localDateTime === "") return "";
  if (!localDateTimePattern.test(localDateTime)) return null;
  const parsed = Timestamp.canonicalSchema.safeParse(`${localDateTime}:00+09:00`);
  if (!parsed.success) return null;
  return toLocalAppointmentDateTime(parsed.data) === localDateTime
    ? parsed.data
    : null;
};
