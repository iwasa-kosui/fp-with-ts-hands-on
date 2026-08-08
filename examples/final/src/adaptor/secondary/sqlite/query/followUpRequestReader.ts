import { eq } from "drizzle-orm";
import { ResultAsync } from "neverthrow";

import type { RepositoryError } from "../../../../domain/aggregate/repositoryError.js";
import { AppointmentId } from "../../../../domain/appointment/appointmentId.js";
import type { FollowUpRequestReader } from "../../../../useCase/query/followUpRequestReader.js";
import type { SqliteDatabase } from "../db.js";
import { domainEventsTable } from "../schema.js";

export const createFollowUpRequestReader = (
  db: SqliteDatabase,
): FollowUpRequestReader => ({
  listRequestedAppointmentIds: () =>
    ResultAsync.fromPromise(
      Promise.resolve().then(() =>
        db
          .select({ appointmentId: domainEventsTable.aggregateId })
          .from(domainEventsTable)
          .where(eq(domainEventsTable.eventName, "follow-up.requested"))
          .all()
          .map(({ appointmentId }) =>
            AppointmentId.schema.parse(appointmentId),
          ),
      ),
      (cause): RepositoryError => ({
        kind: "RepositoryError",
        operation: "FollowUpRequestReader.listRequestedAppointmentIds",
        cause,
      }),
    ),
});
