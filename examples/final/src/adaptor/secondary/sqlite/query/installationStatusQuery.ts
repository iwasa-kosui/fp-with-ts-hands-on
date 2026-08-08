import { ResultAsync } from "neverthrow";
import { z } from "zod";

import type { RepositoryError } from "../../../../domain/aggregate/repositoryError.js";
import type {
  InstallationStatus,
  InstallationStatusQuery,
} from "../../../../useCase/query/installationStatusQuery.js";
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
    ResultAsync.fromPromise(
      Promise.resolve().then(() =>
        toStatus(
          InstallationRowsSchema.parse(
            db.select().from(installationTable).all(),
          ),
        ),
      ),
      (cause): RepositoryError => ({
        kind: "RepositoryError",
        operation: "InstallationStatusQuery.get",
        cause,
      }),
    ),
});
