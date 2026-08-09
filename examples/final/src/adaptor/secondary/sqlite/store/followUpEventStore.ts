import { ResultAsync } from "neverthrow";
import { z } from "zod";

import { AppointmentId } from "../../../../domain/appointment/appointmentId.js";
import type { FollowUpRequested } from "../../../../domain/followUp/followUpRequested.js";
import type { FollowUpStoreError } from "../../../../domain/followUp/followUpStores.js";
import type { SqliteDatabase } from "../db.js";
import { persistDomainEvent } from "../eventPersistence.js";
import { followUpRequestClaimsTable } from "../schema.js";

const FollowUpRequestConflictSchema = z.object({
  kind: z.literal("FollowUpRequestConflict"),
  appointmentId: AppointmentId.schema,
});

export const createFollowUpEventStore = (db: SqliteDatabase) => ({
  store: (...events: readonly FollowUpRequested[]) =>
    ResultAsync.fromPromise<void, FollowUpStoreError>(
      Promise.resolve().then(() =>
        db.transaction((tx) => {
          events.forEach((event) => {
            try {
              tx.insert(followUpRequestClaimsTable)
                .values({ appointmentId: event.aggregateId })
                .run();
            } catch (cause) {
              if (
                cause instanceof Error &&
                cause.message.includes("follow_up_request_claims.appointment_id")
              ) {
                throw {
                  kind: "FollowUpRequestConflict",
                  appointmentId: event.aggregateId,
                } as const;
              }
              throw cause;
            }
            persistDomainEvent(tx, event);
          });
        }),
      ),
      (cause): FollowUpStoreError => {
        const conflict = FollowUpRequestConflictSchema.safeParse(cause);
        return conflict.success
          ? conflict.data
          : {
              kind: "RepositoryError",
              operation: "FollowUpEventStore.store",
              cause,
            };
      },
    ),
} as const);
