import type { ResultAsync } from "neverthrow";

import type { RepositoryError } from "../../domain/aggregate/repositoryError.js";

export type InstallationStatus =
  | Readonly<{ kind: "InitialSetupAvailable" }>
  | Readonly<{ kind: "Installed" }>;

export type InstallationStatusQuery = Readonly<{
  get: () => ResultAsync<InstallationStatus, RepositoryError>;
}>;
