import type { ResultAsync } from "neverthrow";

export type InstallationStatus =
  | Readonly<{ kind: "InitialSetupAvailable" }>
  | Readonly<{ kind: "Installed" }>;

export type InstallationStatusQuery = Readonly<{
  get: () => ResultAsync<InstallationStatus, never>;
}>;
