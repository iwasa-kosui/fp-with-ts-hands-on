import type { ResultAsync } from "neverthrow";

import type { SessionCreated } from "../session/sessionEvent.js";
import type { UserCreated } from "../user/userEvent.js";

export type InitialAdminAlreadyExists = Readonly<{
  kind: "InitialAdminAlreadyExists";
}>;

export type InitialAdminSetupStore = Readonly<{
  store: (
    userEvent: UserCreated,
    sessionEvent: SessionCreated,
  ) => ResultAsync<
    void,
    InitialAdminAlreadyExists
  >;
}>;
