import { ResultAsync } from "neverthrow";

import { AppointmentId } from "../../../../domain/appointment/appointmentId.js";
import type { FollowUpRequestReader } from "../../../../useCase/query/followUpRequestReader.js";
import type { SqliteDatabase } from "../db.js";
import { followUpRequestClaimsTable } from "../schema.js";

export const createFollowUpRequestReader = (
  db: SqliteDatabase,
): FollowUpRequestReader => ({
  listRequestedAppointmentIds: () =>
    ResultAsync.fromSafePromise(
      Promise.resolve().then(() =>
        db
          .select({ appointmentId: followUpRequestClaimsTable.appointmentId })
          .from(followUpRequestClaimsTable)
          .all()
          .map((claim) => AppointmentId.schema.parse(claim.appointmentId)),
      ),
    ),
});
