import { ResultAsync } from "neverthrow";
import { z } from "zod";

import type {
  InstallationStatus,
  InstallationStatusQuery,
} from "../../../../domain/installation/installationStatusQuery.js";
import type { SqliteDatabase } from "../db.js";
import { installationTable } from "../schema.js";

const InstallationRowsSchema = z
  .array(
    z.object({ installationKey: z.literal("clinic") }).strict(),
  )
  .max(1);

const toStatus = (
  rows: z.infer<typeof InstallationRowsSchema>,
): InstallationStatus =>
  rows.length === 0
    ? { kind: "InitialSetupAvailable" }
    : { kind: "Installed" };

export const createInstallationStatusQuery = (
  db: SqliteDatabase,
): InstallationStatusQuery => ({
  get: () =>
    ResultAsync.fromSafePromise(
      Promise.resolve().then(() =>
        toStatus(
          InstallationRowsSchema.parse(
            db.select().from(installationTable).all(),
          ),
        ),
      ),
    ),
});
