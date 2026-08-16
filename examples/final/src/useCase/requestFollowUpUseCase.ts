import {
  err,
  ok,
  ResultAsync,
  okAsync,
  type Result,
  type ResultAsync as UseResultAsync,
} from "neverthrow";

import type { Clock } from "../domain/aggregate/clock.js";
import type { EventIdGenerator } from "../domain/aggregate/eventIdGenerator.js";
import type { AppointmentId } from "../domain/appointment/appointmentId.js";
import {
  collectFollowUpTargets,
  type CollectFollowUpTargetsError,
  type FollowUpTarget,
} from "../domain/followUp/collectFollowUpTargets.js";
import { FollowUpRequested } from "../domain/followUp/followUpRequested.js";
import type { FollowUpResolver } from "../domain/followUp/followUpResolver.js";
import type { FollowUpRequestConflict, FollowUpRequestedStore, FollowUpStoreError } from "../domain/followUp/followUpStores.js";
import type { UserId } from "../domain/user/userId.js";
import type { UserByIdResolver } from "../domain/user/userResolver.js";
import { ensureCanManageClinic } from "./authorization.js";
import { ensureUserFound, type UnauthorizedError } from "./errors.js";
import type { FollowUpRequestReader } from "./query/followUpRequestReader.js";

export type UseCaseInput = Readonly<{
  actorUserId: UserId;
  appointmentIds: readonly AppointmentId[];
}>;
export type UseCaseOk = Readonly<{ appointmentIds: readonly AppointmentId[] }>;
export type FollowUpTargetNotFound = Readonly<{
  kind: "FollowUpTargetNotFound";
  appointmentId: AppointmentId;
}>;
export type IdentityGenerationFailed = Readonly<{
  kind: "IdentityGenerationFailed";
}>;
export type UseCaseError =
  | UnauthorizedError
  | CollectFollowUpTargetsError
  | FollowUpTargetNotFound
  | FollowUpRequestConflict
  | IdentityGenerationFailed;
export type UseCaseOutput = UseResultAsync<UseCaseOk, UseCaseError>;
export type Dependencies = Readonly<{
  userResolver: UserByIdResolver;
  followUpResolver: FollowUpResolver;
  followUpRequestReader: FollowUpRequestReader;
  followUpRequestedStore: FollowUpRequestedStore;
  eventIdGenerator: EventIdGenerator;
  clock: Clock;
}>;
export type RequestFollowUpUseCase = Readonly<{
  run: (input: UseCaseInput) => UseCaseOutput;
}>;

const uniqueIds = (ids: readonly AppointmentId[]): readonly AppointmentId[] =>
  ids.reduce<readonly AppointmentId[]>(
    (unique, id) => (unique.includes(id) ? unique : [...unique, id]),
    [],
  );
const ensureNotRequested =
  (appointmentIds: readonly AppointmentId[]) =>
  (
    requestedIds: readonly AppointmentId[],
  ): Result<void, FollowUpRequestConflict> => {
    const duplicate = uniqueIds(appointmentIds).find((appointmentId) =>
      requestedIds.includes(appointmentId),
    );
    return duplicate === undefined
      ? ok(undefined)
      : err({ kind: "FollowUpRequestConflict", appointmentId: duplicate });
  };
const selectTargets =
  (appointmentIds: readonly AppointmentId[]) =>
  (
    targets: readonly FollowUpTarget[],
  ): Result<readonly FollowUpTarget[], FollowUpTargetNotFound> => {
    const unique = uniqueIds(appointmentIds);
    const missing = unique.find(
      (appointmentId) =>
        !targets.some((target) => target.appointmentId === appointmentId),
    );
    return missing === undefined
      ? ok(
          unique.reduce<readonly FollowUpTarget[]>(
            (selected, appointmentId) => {
              const target = targets.find(
                (candidate) => candidate.appointmentId === appointmentId,
              );
              return target === undefined ? selected : [...selected, target];
            },
            [],
          ),
        )
      : err({ kind: "FollowUpTargetNotFound", appointmentId: missing });
  };
const createFreshEvents =
  (dependencies: Dependencies, input: UseCaseInput) =>
  (targets: readonly FollowUpTarget[]) =>
    ResultAsync.fromPromise(
      Promise.resolve().then(() =>
        targets.map((target) =>
          FollowUpRequested.create(
            {
              eventId: dependencies.eventIdGenerator.generate(),
              occurredAt: dependencies.clock.now(),
              actorUserId: input.actorUserId,
            },
            target.appointmentId,
            target.petId,
          ),
        ),
      ),
      (): IdentityGenerationFailed => ({ kind: "IdentityGenerationFailed" }),
    );
const run =
  (dependencies: Dependencies) =>
  (input: UseCaseInput): UseCaseOutput =>
    dependencies.userResolver
      .resolveById(input.actorUserId)

      .andThen(ensureUserFound(input.actorUserId))
      .andThen(ensureCanManageClinic)
      .andThen(() =>
        dependencies.followUpRequestReader
          .listRequestedAppointmentIds()
          ,
      )
      .andThen(ensureNotRequested(input.appointmentIds))
      .andThen(() =>
        dependencies.followUpResolver
          .resolveCandidates()
          ,
      )
      .andThen(collectFollowUpTargets)
      .andThen(selectTargets(input.appointmentIds))
      .andThen(createFreshEvents(dependencies, input))
      .andThen((events) =>
        events.length === 0
          ? okAsync(events)
          : dependencies.followUpRequestedStore.store(...events).map(() => events),
      )
      .map((events) => ({
        appointmentIds: events.map((event) => event.aggregateId),
      }));

export const RequestFollowUpUseCase = {
  create: (dependencies: Dependencies): RequestFollowUpUseCase => ({
    run: run(dependencies),
  }),
} as const;
