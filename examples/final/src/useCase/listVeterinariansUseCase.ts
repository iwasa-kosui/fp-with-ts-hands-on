import type { ResultAsync } from "neverthrow";
import type { RepositoryError } from "../domain/aggregate/repositoryError.js";
import type { VeterinarianId } from "../domain/appointment/veterinarianId.js";
import type { UserName } from "../domain/user/userName.js";
import type { UserId } from "../domain/user/userId.js";
import type { UserByIdResolver, UserListResolver } from "../domain/user/userResolver.js";
import { ensureUserFound, type UnauthorizedError } from "./errors.js";
export type VeterinarianOption = Readonly<{ veterinarianId: VeterinarianId; name: UserName }>;
export type UseCaseInput = Readonly<{ actorUserId: UserId }>;
export type UseCaseOk = Readonly<{ veterinarians: readonly VeterinarianOption[] }>;
export type UseCaseRepositoryError = Readonly<{ kind: "RepositoryError"; operation: string }>;
export type UseCaseOutput = ResultAsync<UseCaseOk, UnauthorizedError | UseCaseRepositoryError>;
export type Dependencies = Readonly<{ userResolver: UserByIdResolver; userListResolver: UserListResolver }>;
export type ListVeterinariansUseCase = Readonly<{ run: (input: UseCaseInput) => UseCaseOutput }>;
const toRepositoryError = (error: RepositoryError): UseCaseRepositoryError => ({ kind: "RepositoryError", operation: error.operation });
const run = (dependencies: Dependencies) => (input: UseCaseInput): UseCaseOutput => dependencies.userResolver.resolveById(input.actorUserId).mapErr(toRepositoryError)
  .andThen(ensureUserFound(input.actorUserId)).andThen(() => dependencies.userListResolver.resolveAll().mapErr(toRepositoryError))
  .map((users) => ({ veterinarians: users.filter((user) => user.kind === "Veterinarian").map((user) => ({ veterinarianId: user.veterinarianId, name: user.name })) }));
export const ListVeterinariansUseCase = { create: (dependencies: Dependencies): ListVeterinariansUseCase => ({ run: run(dependencies) }) } as const;
