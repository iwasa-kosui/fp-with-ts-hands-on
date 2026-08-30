import { eq } from "drizzle-orm";
import { ResultAsync } from "neverthrow";

import type { FollowUpResolver } from "../../../../domain/followUp/followUpResolver.js";
import { Owner } from "../../../../domain/owner/index.js";
import type { SqliteDatabase } from "../db.js";
import { appointmentsTable, examResultsTable, ownersTable } from "../schema.js";
import { parseAppointmentRow } from "./appointmentResolver.js";
import { parseExamResultRow } from "./examResultResolver.js";

export const createFollowUpResolver = (db: SqliteDatabase): FollowUpResolver => ({
  resolveCandidates: () =>
    ResultAsync.fromSafePromise(
      Promise.resolve().then(() => {
        const rows = db.select({
          appointment: appointmentsTable,
          owner: ownersTable,
          examResult: examResultsTable,
        })
          .from(appointmentsTable)
          .innerJoin(ownersTable, eq(appointmentsTable.ownerId, ownersTable.ownerId))
          .innerJoin(examResultsTable, eq(appointmentsTable.petId, examResultsTable.petId))
          .where(eq(appointmentsTable.status, "Paid"))
          .all();

        return rows.map((row) => ({
          appointment: parseAppointmentRow(row.appointment),
          owner: Owner.schema.parse(row.owner),
          examResult: parseExamResultRow(row.examResult),
        }));
      }),
    ),
});
