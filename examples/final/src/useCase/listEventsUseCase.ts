import { err, ok, type Result, type ResultAsync } from "neverthrow";

import type { User, Admin } from "../domain/user/user.js";
import type { UserId } from "../domain/user/userId.js";
import type { UserByIdResolver } from "../domain/user/userResolver.js";
import { ensureUserFound, type UnauthorizedError } from "./errors.js";
import type {
  EventHistoryReader,
  SanitizedAuditRecord,
} from "./query/eventHistoryReader.js";

export type EventView = SanitizedAuditRecord;
export type UseCaseInput = Readonly<{ actorUserId: UserId }>;
export type UseCaseOk = Readonly<{ events: readonly EventView[] }>;
export type UseCaseError = UnauthorizedError;
export type UseCaseOutput = ResultAsync<UseCaseOk, UseCaseError>;
export type Dependencies = Readonly<{
  userResolver: UserByIdResolver;
  eventHistoryReader: EventHistoryReader;
}>;
export type ListEventsUseCase = Readonly<{
  run: (input: UseCaseInput) => UseCaseOutput;
}>;

const ensureAdmin = (user: User): Result<Admin, UnauthorizedError> =>
  user.kind === "Admin"
    ? ok(user)
    : err({ kind: "Unauthorized", actorUserId: user.userId });
const run =
  (dependencies: Dependencies) =>
  (input: UseCaseInput): UseCaseOutput =>
    dependencies.userResolver
      .resolveById(input.actorUserId)
      .andThen(ensureUserFound(input.actorUserId))
      .andThen(ensureAdmin)
      .andThen((admin) =>
        dependencies.eventHistoryReader.list(admin),
      )
      .map((events) => ({ events }));

export const ListEventsUseCase = {
  create: (dependencies: Dependencies): ListEventsUseCase => ({
    run: run(dependencies),
  }),
} as const;
