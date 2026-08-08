import type { ResultAsync } from "neverthrow";

import type { RepositoryError } from "../../domain/aggregate/repositoryError.js";
import type { SessionCreated } from "../../domain/session/sessionEvent.js";
import type { UserCreated } from "../../domain/user/userEvent.js";

export type InitialAdminAlreadyExists = Readonly<{
  kind: "InitialAdminAlreadyExists";
}>;

export type InitialAdminSetupStore = Readonly<{
  store: (
    userEvent: UserCreated,
    sessionEvent: SessionCreated,
  ) => ResultAsync<
    void,
    InitialAdminAlreadyExists | RepositoryError
  >;
}>;
