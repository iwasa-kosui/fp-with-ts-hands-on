import { and, asc, eq, sql } from "drizzle-orm";
import { ResultAsync } from "neverthrow";
import { z } from "zod";

import type { RepositoryError } from "../../../../domain/aggregate/repositoryError.js";
import { Timestamp } from "../../../../domain/aggregate/timestamp.js";
import { AppointmentDuration } from "../../../../domain/appointment/appointmentDuration.js";
import { AppointmentId } from "../../../../domain/appointment/appointmentId.js";
import { ServiceCode } from "../../../../domain/appointment/serviceCode.js";
import { VeterinarianId } from "../../../../domain/appointment/veterinarianId.js";
import type { AppointmentCalendarItem, AppointmentCalendarReader } from "../../../../useCase/query/appointmentCalendarReader.js";
import type { SqliteDatabase } from "../db.js";
import { appointmentsTable, petsTable, usersTable } from "../schema.js";

const CalendarRowSchema = z.object({
  appointmentId: AppointmentId.schema,
  startsAt: Timestamp.schema,
  durationMinutes: AppointmentDuration.schema,
  petName: z.string().min(1),
  serviceCode: ServiceCode.schema,
  bookingKind: z.enum(["Reserved", "WalkIn"]),
  assignedVeterinarianId: VeterinarianId.schema.nullable(),
  assignedVeterinarianName: z.string().min(1).nullable(),
  appointmentStatus: z.enum(["Scheduled", "CheckedIn", "InExamination", "AwaitingPayment", "Paid", "Canceled"]),
  settlementStatus: z.enum(["NoPayment", "DepositReceived", "Settled", "DepositRefunded"]),
});

const AppointmentCalendarItemSchema = CalendarRowSchema.extend({
  endsAt: Timestamp.schema,
});

const toCalendarItem = (row: z.infer<typeof CalendarRowSchema>): AppointmentCalendarItem =>
  AppointmentCalendarItemSchema.parse({
    ...row,
    endsAt: Timestamp.schema.parse(new Date(Date.parse(row.startsAt) + row.durationMinutes * 60_000).toISOString()),
  });

export const createAppointmentCalendarReader = (db: SqliteDatabase): AppointmentCalendarReader => ({
  list: (_actor, range) => ResultAsync.fromPromise(
    Promise.resolve().then(() => {
      const scheduledInstant = sql<number>`julianday(${appointmentsTable.scheduledAt})`;
      return db.select({
      appointmentId: appointmentsTable.appointmentId,
      startsAt: appointmentsTable.scheduledAt,
      durationMinutes: appointmentsTable.durationMinutes,
      petName: petsTable.name,
      serviceCode: appointmentsTable.serviceCode,
      bookingKind: appointmentsTable.bookingKind,
      assignedVeterinarianId: appointmentsTable.assignedVeterinarianId,
      assignedVeterinarianName: usersTable.name,
      appointmentStatus: appointmentsTable.status,
      settlementStatus: appointmentsTable.settlementStatus,
    }).from(appointmentsTable)
      .innerJoin(petsTable, eq(petsTable.petId, appointmentsTable.petId))
      .leftJoin(usersTable, and(
        eq(usersTable.veterinarianId, appointmentsTable.assignedVeterinarianId),
        eq(usersTable.role, "Veterinarian"),
      ))
      .where(sql`${scheduledInstant} >= julianday(${range.startsAt})
        AND ${scheduledInstant} < julianday(${range.endsAt})`)
      .orderBy(asc(scheduledInstant), asc(petsTable.name))
      .all().map((row) => CalendarRowSchema.parse(row)).map(toCalendarItem);
    }),
    (cause): RepositoryError => ({ kind: "RepositoryError", operation: "AppointmentCalendarReader.list", cause }),
  ),
});
