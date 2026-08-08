import { eq } from "drizzle-orm";
import { ResultAsync } from "neverthrow";
import { z } from "zod";

import type { RepositoryError } from "../../../../domain/aggregate/repositoryError.js";
import { Timestamp } from "../../../../domain/aggregate/timestamp.js";
import { AppointmentId } from "../../../../domain/appointment/appointmentId.js";
import type { AppointmentResolver } from "../../../../domain/appointment/appointmentResolver.js";
import { PaymentAmount } from "../../../../domain/appointment/paymentAmount.js";
import { VeterinarianId } from "../../../../domain/appointment/veterinarianId.js";
import { OwnerId } from "../../../../domain/owner/ownerId.js";
import { PetId } from "../../../../domain/pet/petId.js";
import type { SqliteDatabase } from "../db.js";
import { appointmentsTable } from "../schema.js";

const baseShape = {
  appointmentId: AppointmentId.schema,
  petId: PetId.schema,
  ownerId: OwnerId.schema,
  scheduledAt: Timestamp.schema,
  reason: z.string(),
};
const AppointmentSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("Scheduled"), ...baseShape }),
  z.object({ kind: z.literal("CheckedIn"), ...baseShape, checkedInAt: Timestamp.schema }),
  z.object({
    kind: z.literal("InExamination"),
    ...baseShape,
    checkedInAt: Timestamp.schema,
    veterinarianId: VeterinarianId.schema,
    examinationStartedAt: Timestamp.schema,
  }),
  z.object({
    kind: z.literal("Paid"),
    ...baseShape,
    checkedInAt: Timestamp.schema,
    veterinarianId: VeterinarianId.schema,
    examinationStartedAt: Timestamp.schema,
    diagnosis: z.string(),
    treatment: z.string(),
    amount: PaymentAmount.schema,
    paidAt: Timestamp.schema,
  }),
  z.object({
    kind: z.literal("Canceled"),
    ...baseShape,
    canceledAt: Timestamp.schema,
  }),
]);

export const parseAppointmentState = (state: unknown) => AppointmentSchema.parse(state);
const repositoryError = (operation: string) => (cause: unknown): RepositoryError => ({
  kind: "RepositoryError",
  operation,
  cause,
});

export const createAppointmentResolver = (db: SqliteDatabase): AppointmentResolver => ({
  resolveById: (appointmentId) =>
    ResultAsync.fromPromise(
      Promise.resolve().then(() => {
        const row = db.select().from(appointmentsTable)
          .where(eq(appointmentsTable.appointmentId, appointmentId))
          .get();
        return row === undefined ? undefined : parseAppointmentState(row.state);
      }),
      repositoryError("AppointmentResolver.resolveById"),
    ),
});
