import { z } from "zod";

import type { Timestamp } from "../aggregate/timestamp.js";
import { Timestamp as TimestampValue } from "../aggregate/timestamp.js";

const BusinessDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).superRefine((value, context) => {
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "実在する日付を指定してください" });
  }
}).brand<"BusinessDate">();

export type BusinessDate = z.infer<typeof BusinessDateSchema>;
export type BusinessDateRange = Readonly<{ startsAt: Timestamp; endsAt: Timestamp }>;

const midnightInJst = (date: BusinessDate): Timestamp =>
  TimestampValue.schema.parse(new Date(`${date}T00:00:00+09:00`).toISOString());

const shift = (date: BusinessDate, days: number): BusinessDate => {
  const atNoonUtc = new Date(`${date}T12:00:00.000Z`);
  atNoonUtc.setUTCDate(atNoonUtc.getUTCDate() + days);
  return BusinessDateSchema.parse(atNoonUtc.toISOString().slice(0, 10));
};

const dayRange = (date: BusinessDate): BusinessDateRange => ({
  startsAt: midnightInJst(date),
  endsAt: midnightInJst(shift(date, 1)),
});

const weekRange = (date: BusinessDate): BusinessDateRange => {
  const dayOfWeek = new Date(`${date}T12:00:00.000Z`).getUTCDay();
  const monday = shift(date, -((dayOfWeek + 6) % 7));
  return { startsAt: midnightInJst(monday), endsAt: midnightInJst(shift(monday, 7)) };
};

const fromTimestamp = (timestamp: Timestamp): BusinessDate => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(timestamp));
  const value = (kind: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === kind)?.value ?? "";
  return BusinessDateSchema.parse(`${value("year")}-${value("month")}-${value("day")}`);
};

export const BusinessDate = {
  schema: BusinessDateSchema,
  dayRange,
  weekRange,
  shift,
  fromTimestamp,
} as const;
