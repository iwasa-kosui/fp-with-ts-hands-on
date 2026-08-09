import { Timestamp } from "../../../domain/aggregate/timestamp.js";
import type { SqliteDatabase } from "./db.js";
import { appointmentsTable } from "./schema.js";

export const ensureAppointmentScheduledTimestampsValid = (
  db: SqliteDatabase,
): void => {
  const corrupt = db.select({ scheduledAt: appointmentsTable.scheduledAt })
    .from(appointmentsTable)
    .all()
    .find(({ scheduledAt }) => !Timestamp.schema.safeParse(scheduledAt).success);
  if (corrupt !== undefined) {
    throw new TypeError("Corrupt appointment scheduled timestamp projection");
  }
};
