import { err, ok, type Result, type ResultAsync } from "neverthrow";

import type { RepositoryError } from "../domain/aggregate/repositoryError.js";
import type { User, Admin } from "../domain/user/user.js";
import type { UserId } from "../domain/user/userId.js";
import type { UserByIdResolver } from "../domain/user/userResolver.js";
import { ensureUserFound, type UnauthorizedError } from "./errors.js";
import type {
  AuditEventSummary,
  EventHistoryReader,
} from "./query/eventHistoryReader.js";

export type EventView = AuditEventSummary;
export type UseCaseInput = Readonly<{ actorUserId: UserId }>;
export type UseCaseOk = Readonly<{ events: readonly EventView[] }>;
export type UseCaseRepositoryError = Readonly<{
  kind: "RepositoryError";
  operation: string;
}>;
export type UseCaseError = UnauthorizedError | UseCaseRepositoryError;
export type UseCaseOutput = ResultAsync<UseCaseOk, UseCaseError>;
export type Dependencies = Readonly<{
  userResolver: UserByIdResolver;
  eventHistoryReader: EventHistoryReader;
}>;
export type ListEventsUseCase = Readonly<{
  run: (input: UseCaseInput) => UseCaseOutput;
}>;

const toRepositoryError = (error: RepositoryError): UseCaseRepositoryError => ({
  kind: "RepositoryError",
  operation: error.operation,
});
const ensureAdmin = (user: User): Result<Admin, UnauthorizedError> =>
  user.kind === "Admin"
    ? ok(user)
    : err({ kind: "Unauthorized", actorUserId: user.userId });
const run =
  (dependencies: Dependencies) =>
  (input: UseCaseInput): UseCaseOutput =>
    dependencies.userResolver
      .resolveById(input.actorUserId)
      .mapErr(toRepositoryError)
      .andThen(ensureUserFound(input.actorUserId))
      .andThen(ensureAdmin)
      .andThen((admin) =>
        dependencies.eventHistoryReader.list(admin).mapErr(toRepositoryError),
      )
      .map((events) => ({ events }));

export const ListEventsUseCase = {
  create: (dependencies: Dependencies): ListEventsUseCase => ({
    run: run(dependencies),
  }),
} as const;
