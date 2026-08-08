import { and, eq } from "drizzle-orm";
import { ResultAsync } from "neverthrow";

import { EventId } from "../../../../domain/aggregate/eventId.js";
import type { RepositoryError } from "../../../../domain/aggregate/repositoryError.js";
import { Timestamp } from "../../../../domain/aggregate/timestamp.js";
import type { FollowUpResolver } from "../../../../domain/followUp/followUpResolver.js";
import { Owner } from "../../../../domain/owner/owner.js";
import { UserId } from "../../../../domain/user/userId.js";
import type { SqliteDatabase } from "../db.js";
import { appointmentsTable, domainEventsTable, examResultsTable, ownersTable } from "../schema.js";
import { parseAppointmentState } from "./appointmentResolver.js";
import { parseExamResultState } from "./examResultResolver.js";

export const createFollowUpResolver = (db: SqliteDatabase): FollowUpResolver => ({
  resolveCandidates: () =>
    ResultAsync.fromPromise(
      Promise.resolve().then(() => {
        const rows = db.select({
          appointmentState: appointmentsTable.state,
          owner: ownersTable,
          examResultState: examResultsTable.state,
          eventId: domainEventsTable.eventId,
          occurredAt: domainEventsTable.occurredAt,
          actorUserId: domainEventsTable.actorUserId,
        })
          .from(appointmentsTable)
          .innerJoin(ownersTable, eq(appointmentsTable.ownerId, ownersTable.ownerId))
          .innerJoin(examResultsTable, eq(appointmentsTable.petId, examResultsTable.petId))
          .innerJoin(
            domainEventsTable,
            and(
              eq(domainEventsTable.aggregateId, appointmentsTable.appointmentId),
              eq(domainEventsTable.eventName, "appointment.payment-recorded"),
            ),
          )
          .where(eq(appointmentsTable.status, "Paid"))
          .all();

        return rows.map((row) => ({
          appointment: parseAppointmentState(row.appointmentState),
          owner: Owner.schema.parse(row.owner),
          examResult: parseExamResultState(row.examResultState),
          context: {
            eventId: EventId.schema.parse(row.eventId),
            occurredAt: Timestamp.schema.parse(row.occurredAt),
            actorUserId: UserId.schema.parse(row.actorUserId),
          },
        }));
      }),
      (cause): RepositoryError => ({
        kind: "RepositoryError",
        operation: "FollowUpResolver.resolveCandidates",
        cause,
      }),
    ),
});
