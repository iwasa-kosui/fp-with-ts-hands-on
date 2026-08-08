import { errAsync, okAsync } from "neverthrow";
import { describe, expect, test } from "vitest";

import { scryptPasswordHasher } from "../../src/adaptor/secondary/authentication/scryptPasswordHasher.js";
import type { Clock } from "../../src/domain/aggregate/clock.js";
import { EventId } from "../../src/domain/aggregate/eventId.js";
import type { EventIdGenerator } from "../../src/domain/aggregate/eventIdGenerator.js";
import type { RepositoryError } from "../../src/domain/aggregate/repositoryError.js";
import { Timestamp } from "../../src/domain/aggregate/timestamp.js";
import type { Session } from "../../src/domain/session/session.js";
import type {
  SessionCreated,
  SessionDeleted,
} from "../../src/domain/session/sessionEvent.js";
import { SessionId } from "../../src/domain/session/sessionId.js";
import type { SessionResolver } from "../../src/domain/session/sessionResolver.js";
import type {
  SessionCreatedStore,
  SessionDeletedStore,
} from "../../src/domain/session/sessionStores.js";
import type { SessionTokenGenerator } from "../../src/domain/session/sessionTokenGenerator.js";
import { SessionTokenHash } from "../../src/domain/session/sessionTokenHash.js";
import { Sensitive } from "../../src/domain/shared/sensitive.js";
import type { User } from "../../src/domain/user/user.js";
import { UserEmail } from "../../src/domain/user/userEmail.js";
import type { UserCreated } from "../../src/domain/user/userEvent.js";
import { UserId } from "../../src/domain/user/userId.js";
import { UserName } from "../../src/domain/user/userName.js";
import type { UserResolver } from "../../src/domain/user/userResolver.js";
import type { UserCreatedStore } from "../../src/domain/user/userStores.js";
import {
  LogInUseCase,
  type Dependencies as LogInDependencies,
} from "../../src/useCase/logInUseCase.js";
import {
  LogOutUseCase,
  type Dependencies as LogOutDependencies,
} from "../../src/useCase/logOutUseCase.js";
import {
  SetUpInitialAdminUseCase,
  type Dependencies as SetUpDependencies,
} from "../../src/useCase/setUpInitialAdminUseCase.js";

const userId = UserId.schema.parse("10000000-0000-4000-8000-000000000001");
const sessionId = SessionId.schema.parse(
  "10000000-0000-4000-8000-000000000002",
);
const eventIds = [
  EventId.schema.parse("10000000-0000-4000-8000-000000000003"),
  EventId.schema.parse("10000000-0000-4000-8000-000000000004"),
] as const;
const now = Timestamp.schema.parse("2026-08-09T01:30:00.000Z");
const expiresAt = Timestamp.schema.parse("2026-08-09T09:30:00.000Z");
const email = UserEmail.schema.parse("admin@example.test");
const name = UserName.schema.parse("Clinic Admin");
const password = Sensitive.of("correct horse battery staple");
const wrongPassword = Sensitive.of("wrong password");
const token = {
  plaintext: Sensitive.of("cookie-only-token"),
  hash: SessionTokenHash.schema.parse("a".repeat(64)),
} as const;
const repositoryError = {
  kind: "RepositoryError",
  operation: "test resolver",
  cause: new Error("row contains admin@example.test"),
} as const satisfies RepositoryError;

const eventIdGenerator = (): EventIdGenerator => {
  let index = 0;
  return {
    generate: () => eventIds[index++] ?? eventIds[1],
  } as const satisfies EventIdGenerator;
};

const clock = { now: () => now } as const satisfies Clock;
const sessionTokenGenerator = {
  generate: () => token,
} as const satisfies SessionTokenGenerator;

const userResolverFor = (users: readonly User[]): UserResolver => ({
  resolveById: (resolvedUserId) =>
    okAsync(users.find((user) => user.userId === resolvedUserId)),
  resolveByEmail: (resolvedEmail) =>
    okAsync(
      users.find((user) => user.email.unwrap() === resolvedEmail.unwrap()),
    ),
  resolveAll: () => okAsync(users),
});

const sessionResolverFor = (session: Session | undefined): SessionResolver => ({
  resolveById: () => okAsync(session),
  resolveByTokenHash: () => okAsync(session),
  resolveByUserId: () => okAsync(session === undefined ? [] : [session]),
});

const createdUserStore = (events: UserCreated[]): UserCreatedStore => ({
  store: (...newEvents) => {
    events.push(...newEvents);
    return okAsync(undefined);
  },
});

const createdSessionStore = (
  events: SessionCreated[],
): SessionCreatedStore => ({
  store: (...newEvents) => {
    events.push(...newEvents);
    return okAsync(undefined);
  },
});

const deletedSessionStore = (
  events: SessionDeleted[],
): SessionDeletedStore => ({
  store: (...newEvents) => {
    events.push(...newEvents);
    return okAsync(undefined);
  },
});

const setupDependencies = (
  users: readonly User[],
  userEvents: UserCreated[],
  sessionEvents: SessionCreated[],
): SetUpDependencies => ({
  userResolver: userResolverFor(users),
  userCreatedStore: createdUserStore(userEvents),
  sessionCreatedStore: createdSessionStore(sessionEvents),
  passwordHasher: scryptPasswordHasher,
  sessionTokenGenerator,
  clock,
  eventIdGenerator: eventIdGenerator(),
  userIdGenerator: { generate: () => userId },
  sessionIdGenerator: { generate: () => sessionId },
});

describe("SetUpInitialAdminUseCase", () => {
  test("creates the first Admin and an eight-hour session without exposing credential hashes", async () => {
    const userEvents: UserCreated[] = [];
    const sessionEvents: SessionCreated[] = [];
    const useCase = SetUpInitialAdminUseCase.create(
      setupDependencies([], userEvents, sessionEvents),
    );

    const result = await useCase.run({ email, name, password });

    expect(result.isOk()).toBe(true);
    expect(userEvents).toHaveLength(1);
    expect(userEvents[0]).toMatchObject({
      kind: "UserCreated",
      aggregateId: userId,
      actorUserId: userId,
      eventPayload: { userId, role: "Admin" },
    });
    expect(Object.keys(userEvents[0]?.eventPayload ?? {})).toEqual([
      "userId",
      "role",
    ]);
    expect(sessionEvents).toHaveLength(1);
    expect(sessionEvents[0]?.aggregateState.expiresAt).toBe(expiresAt);
    expect(result._unsafeUnwrap()).toEqual({
      userId,
      sessionId,
      expiresAt,
      sessionToken: token.plaintext,
    });
    const serialized = JSON.stringify(result._unsafeUnwrap());
    expect(serialized).not.toContain(password.unwrap());
    expect(serialized).not.toContain(
      userEvents[0]?.aggregateState.passwordHash.unwrap() ?? "missing",
    );
    expect(serialized).not.toContain(token.hash.unwrap());
  });

  test("rejects setup when any user already exists", async () => {
    const existingHash = await scryptPasswordHasher.hash(password);
    const existing = {
      kind: "Admin",
      userId,
      email,
      name,
      passwordHash: existingHash,
    } as const satisfies User;
    const userEvents: UserCreated[] = [];
    const sessionEvents: SessionCreated[] = [];
    const useCase = SetUpInitialAdminUseCase.create(
      setupDependencies([existing], userEvents, sessionEvents),
    );

    const result = await useCase.run({ email, name, password });

    expect(result.isErr() && result.error).toEqual({
      kind: "InitialAdminAlreadyExists",
    });
    expect(userEvents).toHaveLength(0);
    expect(sessionEvents).toHaveLength(0);
  });

  test("returns a typed redacted error when password hashing throws synchronously", async () => {
    const dependencies = {
      ...setupDependencies([], [], []),
      passwordHasher: {
        hash: () => {
          throw new Error(`hash failed for ${password.unwrap()}`);
        },
        verify: scryptPasswordHasher.verify,
      },
    } as const satisfies SetUpDependencies;

    const result = await SetUpInitialAdminUseCase.create(dependencies).run({
      email,
      name,
      password,
    });

    expect(result.isErr() && result.error).toEqual({
      kind: "PasswordHashingFailed",
    });
    expect(JSON.stringify(result)).not.toContain(password.unwrap());
  });
});

describe("LogInUseCase", () => {
  test("verifies the password and returns only the plaintext token needed by the cookie boundary", async () => {
    const passwordHash = await scryptPasswordHasher.hash(password);
    const admin = {
      kind: "Admin",
      userId,
      email,
      name,
      passwordHash,
    } as const satisfies User;
    const events: SessionCreated[] = [];
    const dependencies = {
      userResolver: userResolverFor([admin]),
      sessionCreatedStore: createdSessionStore(events),
      passwordHasher: scryptPasswordHasher,
      sessionTokenGenerator,
      clock,
      eventIdGenerator: eventIdGenerator(),
      sessionIdGenerator: { generate: () => sessionId },
    } as const satisfies LogInDependencies;

    const result = await LogInUseCase.create(dependencies).run({
      email,
      password,
    });

    expect(result._unsafeUnwrap()).toEqual({
      userId,
      sessionId,
      expiresAt,
      sessionToken: token.plaintext,
    });
    expect(events[0]?.kind).toBe("SessionCreated");
    expect(events[0]?.aggregateState.tokenHash).toBe(token.hash);
    expect(JSON.stringify(result._unsafeUnwrap())).not.toContain(
      token.hash.unwrap(),
    );
  });

  test("uses the same non-enumerating error for a missing user and a bad password", async () => {
    const passwordHash = await scryptPasswordHasher.hash(password);
    const admin = {
      kind: "Admin",
      userId,
      email,
      name,
      passwordHash,
    } as const satisfies User;
    const base = {
      sessionCreatedStore: createdSessionStore([]),
      passwordHasher: scryptPasswordHasher,
      sessionTokenGenerator,
      clock,
      eventIdGenerator: eventIdGenerator(),
      sessionIdGenerator: { generate: () => sessionId },
    } as const;

    const missing = await LogInUseCase.create({
      ...base,
      userResolver: userResolverFor([]),
    }).run({ email, password });
    const incorrect = await LogInUseCase.create({
      ...base,
      userResolver: userResolverFor([admin]),
    }).run({ email, password: wrongPassword });

    expect(missing.isErr() && missing.error).toEqual({
      kind: "InvalidCredentials",
    });
    expect(incorrect.isErr() && incorrect.error).toEqual({
      kind: "InvalidCredentials",
    });
  });

  test("returns typed redacted errors for resolver and password verification failures", async () => {
    const failingResolver = {
      resolveById: () => errAsync(repositoryError),
      resolveByEmail: () => errAsync(repositoryError),
      resolveAll: () => errAsync(repositoryError),
    } as const satisfies UserResolver;
    const resolverResult = await LogInUseCase.create({
      userResolver: failingResolver,
      sessionCreatedStore: createdSessionStore([]),
      passwordHasher: scryptPasswordHasher,
      sessionTokenGenerator,
      clock,
      eventIdGenerator: eventIdGenerator(),
      sessionIdGenerator: { generate: () => sessionId },
    }).run({ email, password });
    expect(resolverResult.isErr() && resolverResult.error).toEqual({
      kind: "RepositoryError",
      operation: "test resolver",
    });

    const passwordHash = await scryptPasswordHasher.hash(password);
    const admin = {
      kind: "Admin",
      userId,
      email,
      name,
      passwordHash,
    } as const satisfies User;
    const verifyResult = await LogInUseCase.create({
      userResolver: userResolverFor([admin]),
      sessionCreatedStore: createdSessionStore([]),
      passwordHasher: {
        hash: scryptPasswordHasher.hash,
        verify: () => Promise.reject(new Error("password included here")),
      },
      sessionTokenGenerator,
      clock,
      eventIdGenerator: eventIdGenerator(),
      sessionIdGenerator: { generate: () => sessionId },
    }).run({ email, password });

    expect(verifyResult.isErr() && verifyResult.error).toEqual({
      kind: "PasswordVerificationFailed",
    });
    expect(JSON.stringify(verifyResult)).not.toContain(password.unwrap());
  });
});

describe("LogOutUseCase", () => {
  test("stores a typed deletion event without exposing token material", async () => {
    const session = {
      sessionId,
      userId,
      tokenHash: token.hash,
      expiresAt,
    } as const satisfies Session;
    const events: SessionDeleted[] = [];
    const dependencies = {
      sessionResolver: sessionResolverFor(session),
      sessionDeletedStore: deletedSessionStore(events),
      clock,
      eventIdGenerator: eventIdGenerator(),
    } as const satisfies LogOutDependencies;

    const result = await LogOutUseCase.create(dependencies).run({
      actorUserId: userId,
      sessionId,
    });

    expect(result._unsafeUnwrap()).toEqual({ sessionId });
    expect(events[0]).toMatchObject({
      kind: "SessionDeleted",
      aggregateId: sessionId,
      aggregateState: undefined,
      eventPayload: { sessionId, userId },
    });
    expect(JSON.stringify(events[0])).not.toContain(token.hash.unwrap());
  });
});
