import { okAsync, type ResultAsync } from "neverthrow";

import type { RepositoryError } from "../domain/repositoryError.js";
import type { AppointmentId } from "../domain/appointmentId.js";
import {
  collectFollowUpTargets,
  type FollowUpCandidate,
} from "../domain/followUp/collectFollowUpTargets.js";
import type { FollowUpRequested } from "../domain/followUp/followUpRequested.js";
import type { Timestamp } from "../domain/timestamp.js";
import type { User } from "../domain/user/user.js";
import type { UserId } from "../domain/user/userId.js";

export type Unauthorized = Readonly<{
  kind: "Unauthorized";
  actorUserId: UserId;
}>;

export type FollowUpRequestConflict = Readonly<{
  kind: "FollowUpRequestConflict";
  appointmentId: AppointmentId;
}>;

export type RequestFollowUpError =
  | Unauthorized
  | FollowUpRequestConflict
  | RepositoryError;

export type RequestFollowUpDependencies = Readonly<{
  userResolver: Readonly<{
    resolveById: (
      userId: UserId,
    ) => ResultAsync<User | undefined, RepositoryError>;
  }>;
  followUpResolver: Readonly<{
    resolveCandidates: () => ResultAsync<
      readonly FollowUpCandidate[],
      RepositoryError
    >;
  }>;
  followUpRequestReader: Readonly<{
    listRequestedAppointmentIds: () => ResultAsync<
      readonly AppointmentId[],
      RepositoryError
    >;
  }>;
  followUpRequestedStore: Readonly<{
    store: (
      ...events: readonly FollowUpRequested[]
    ) => ResultAsync<void, RepositoryError | FollowUpRequestConflict>;
  }>;
  clock: Readonly<{ now: () => Timestamp }>;
}>;

export type RequestFollowUpInput = Readonly<{
  actorUserId: UserId;
  appointmentIds: readonly AppointmentId[];
}>;

export type RequestFollowUpUseCase = Readonly<{
  run: (
    input: RequestFollowUpInput,
  ) => ResultAsync<
    Readonly<{ appointmentIds: readonly AppointmentId[] }>,
    RequestFollowUpError
  >;
}>;

const run =
  (dependencies: RequestFollowUpDependencies) =>
  (input: RequestFollowUpInput) =>
    dependencies.followUpResolver
      .resolveCandidates()
      .andThen(collectFollowUpTargets)
      .map((targets) =>
        targets.filter((target) =>
          input.appointmentIds.includes(target.appointmentId),
        ),
      )
      .andThen((targets) => {
        const events = targets.map((target) => ({
          ...target.event,
          occurredAt: dependencies.clock.now(),
          actorUserId: input.actorUserId,
        }));
        return events.length === 0
          ? okAsync(events)
          : dependencies.followUpRequestedStore
              .store(...events)
              .map(() => events);
      })
      .map((events) => ({
        appointmentIds: events.map((event) => event.aggregateId),
      }));

export const RequestFollowUpUseCase = {
  create: (
    dependencies: RequestFollowUpDependencies,
  ): RequestFollowUpUseCase => ({ run: run(dependencies) }),
} as const;
