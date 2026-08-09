import { z } from "zod";
import { schemaResult } from "../shared/schemaResult.js";

const timestampParts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(?:Z|([+-])(\d{2}):?(\d{2}))$/;

const isLeapYear = (year: number): boolean =>
  year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);

const daysInMonth = (year: number, month: number): number => {
  const days = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return days[month - 1] ?? 0;
};

const canonicalFourDigitYearInstant = (value: string): string | undefined => {
  const epochMilliseconds = Date.parse(value);
  if (!Number.isFinite(epochMilliseconds)) return undefined;
  const canonical = new Date(epochMilliseconds).toISOString();
  return /^\d{4}-/.test(canonical) ? canonical : undefined;
};

const isRealFiniteInstant = (value: string): boolean => {
  const match = timestampParts.exec(value);
  if (match === null) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const offsetHour = match[9] === undefined ? 0 : Number(match[9]);
  const offsetMinute = match[10] === undefined ? 0 : Number(match[10]);
  return month >= 1 && month <= 12 &&
    day >= 1 && day <= daysInMonth(year, month) &&
    offsetHour <= 14 && offsetMinute <= 59 &&
    (offsetHour < 14 || offsetMinute === 0) &&
    canonicalFourDigitYearInstant(value) !== undefined;
};

const TimestampSchema = z.string()
  .datetime({ offset: true })
  .refine(isRealFiniteInstant, { message: "Invalid timestamp" })
  .brand<"Timestamp">();

const CanonicalTimestampSchema = TimestampSchema.transform((value, context) => {
  const canonical = canonicalFourDigitYearInstant(value);
  if (canonical === undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid timestamp" });
    return z.NEVER;
  }
  return canonical;
}).pipe(TimestampSchema);

export type Timestamp = z.infer<typeof TimestampSchema>;

export const Timestamp = {
  schema: TimestampSchema,
  canonicalSchema: CanonicalTimestampSchema,
  parse: schemaResult(TimestampSchema),
  toEpochMilliseconds: (value: Timestamp): number => Date.parse(value),
} as const;
