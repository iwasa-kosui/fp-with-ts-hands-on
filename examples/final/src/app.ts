import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

import { inertia } from "@hono/inertia";
import { Hono } from "hono";
import { csrf } from "hono/csrf";
import { HTTPException } from "hono/http-exception";
import { secureHeaders } from "hono/secure-headers";

import { scryptPasswordHasher } from "./adaptor/secondary/authentication/scryptPasswordHasher.js";
import { sessionTokenGenerator } from "./adaptor/secondary/authentication/sessionToken.js";
import {
  createSqliteDatabase,
  migrateDatabase,
  type SqliteDatabase,
} from "./adaptor/secondary/sqlite/db.js";
import { createAppointmentListResolver } from "./adaptor/secondary/sqlite/resolver/appointmentResolver.js";
import { createOwnerListResolver } from "./adaptor/secondary/sqlite/resolver/ownerResolver.js";
import { createPetListResolver } from "./adaptor/secondary/sqlite/resolver/petResolver.js";
import {
  createSessionByIdResolver,
  createSessionByTokenHashResolver,
} from "./adaptor/secondary/sqlite/resolver/sessionResolver.js";
import {
  createUserByEmailResolver,
  createUserByIdResolver,
  createUserListResolver,
} from "./adaptor/secondary/sqlite/resolver/userResolver.js";
import { createSessionEventStore } from "./adaptor/secondary/sqlite/store/sessionEventStore.js";
import { createUserEventStore } from "./adaptor/secondary/sqlite/store/userEventStore.js";
import { createAuthenticationMiddleware } from "./adaptor/primary/web/middleware/authentication.js";
import { createSharedPropsMiddleware } from "./adaptor/primary/web/middleware/sharedProps.js";
import type { WebEnvironment } from "./adaptor/primary/web/pageProps.js";
import { rootView } from "./adaptor/primary/web/rootView.js";
import { registerAuthRoutes } from "./adaptor/primary/web/routes/authRoutes.js";
import { registerDashboardRoutes } from "./adaptor/primary/web/routes/dashboardRoutes.js";
import type { Clock } from "./domain/aggregate/clock.js";
import { EventId } from "./domain/aggregate/eventId.js";
import type { EventIdGenerator } from "./domain/aggregate/eventIdGenerator.js";
import { Timestamp } from "./domain/aggregate/timestamp.js";
import type { SessionByTokenHashResolver } from "./domain/session/sessionResolver.js";
import { SessionId } from "./domain/session/sessionId.js";
import { PasswordHash } from "./domain/user/passwordHash.js";
import type { UserByIdResolver, UserListResolver } from "./domain/user/userResolver.js";
import { UserId } from "./domain/user/userId.js";
import { GetDashboardUseCase, type GetDashboardUseCase as GetDashboard } from "./useCase/getDashboardUseCase.js";
import { LogInUseCase, type LogInUseCase as LogIn } from "./useCase/logInUseCase.js";
import { LogOutUseCase, type LogOutUseCase as LogOut } from "./useCase/logOutUseCase.js";
import {
  SetUpInitialAdminUseCase,
  type SetUpInitialAdminUseCase as SetUpInitialAdmin,
} from "./useCase/setUpInitialAdminUseCase.js";

export type ApplicationDependencies = Readonly<{
  sessionByTokenHashResolver: SessionByTokenHashResolver;
  authenticatedUserByIdResolver: UserByIdResolver;
  userListResolver: UserListResolver;
  setUpInitialAdmin: SetUpInitialAdmin;
  logIn: LogIn;
  logOut: LogOut;
  getDashboard: GetDashboard;
  clock: Clock;
  isProduction: boolean;
}>;

type CompositionOptions = Readonly<{
  clock?: Clock;
  isProduction?: boolean;
}>;

const systemClock: Clock = {
  now: () => Timestamp.schema.parse(new Date().toISOString()),
};
const eventIdGenerator: EventIdGenerator = {
  generate: () => EventId.schema.parse(randomUUID()),
};
const userIdGenerator = {
  generate: () => UserId.schema.parse(randomUUID()),
} as const;
const sessionIdGenerator = {
  generate: () => SessionId.schema.parse(randomUUID()),
} as const;
const dummyPasswordHash = PasswordHash.schema.parse(
  `scrypt$${"D".repeat(22)}==$${"E".repeat(86)}==`,
);

export const createApplicationDependencies = (
  database: SqliteDatabase,
  options: CompositionOptions = {},
): ApplicationDependencies => {
  const clock = options.clock ?? systemClock;

  const sessionByTokenHashResolver =
    createSessionByTokenHashResolver(database);
  const sessionByIdResolver = createSessionByIdResolver(database);
  const authenticatedUserByIdResolver = createUserByIdResolver(database);
  const setupUserListResolver = createUserListResolver(database);
  const loginUserByEmailResolver = createUserByEmailResolver(database);
  const dashboardUserByIdResolver = createUserByIdResolver(database);
  const dashboardUserListResolver = createUserListResolver(database);
  const appointmentListResolver = createAppointmentListResolver(database);
  const ownerListResolver = createOwnerListResolver(database);
  const petListResolver = createPetListResolver(database);
  const userEventStore = createUserEventStore(database);
  const sessionEventStore = createSessionEventStore(database);

  return {
    sessionByTokenHashResolver,
    authenticatedUserByIdResolver,
    userListResolver: setupUserListResolver,
    setUpInitialAdmin: SetUpInitialAdminUseCase.create({
      userResolver: setupUserListResolver,
      userCreatedStore: userEventStore,
      sessionCreatedStore: sessionEventStore,
      passwordHasher: scryptPasswordHasher,
      sessionTokenGenerator,
      clock,
      eventIdGenerator,
      userIdGenerator,
      sessionIdGenerator,
    }),
    logIn: LogInUseCase.create({
      userResolver: loginUserByEmailResolver,
      sessionCreatedStore: sessionEventStore,
      passwordHasher: scryptPasswordHasher,
      dummyPasswordHash,
      sessionTokenGenerator,
      clock,
      eventIdGenerator,
      sessionIdGenerator,
    }),
    logOut: LogOutUseCase.create({
      sessionResolver: sessionByIdResolver,
      sessionDeletedStore: sessionEventStore,
      clock,
      eventIdGenerator,
    }),
    getDashboard: GetDashboardUseCase.create({
      userResolver: dashboardUserByIdResolver,
      appointmentListResolver,
      ownerListResolver,
      petListResolver,
      userListResolver: dashboardUserListResolver,
    }),
    clock,
    isProduction:
      options.isProduction ?? process.env.NODE_ENV === "production",
  };
};

export const createApp = (dependencies: ApplicationDependencies) => {
  const app = new Hono<WebEnvironment>();

  app.use("*", secureHeaders());
  app.use("*", csrf());
  app.use("*", inertia({ version: "1", rootView }));
  app.use(
    "*",
    createAuthenticationMiddleware({
      sessionResolver: dependencies.sessionByTokenHashResolver,
      userResolver: dependencies.authenticatedUserByIdResolver,
      clock: dependencies.clock,
      isProduction: dependencies.isProduction,
    }),
  );
  app.use("*", createSharedPropsMiddleware());

  registerAuthRoutes(app, {
    userResolver: dependencies.userListResolver,
    setUpInitialAdmin: dependencies.setUpInitialAdmin,
    logIn: dependencies.logIn,
    logOut: dependencies.logOut,
    clock: dependencies.clock,
    isProduction: dependencies.isProduction,
  });
  registerDashboardRoutes(app, {
    userResolver: dependencies.userListResolver,
    getDashboard: dependencies.getDashboard,
  });

  app.onError((error) =>
    error instanceof HTTPException
      ? error.getResponse()
      : new Response("Internal Server Error", { status: 500 }),
  );
  return app;
};

const databasePath =
  process.env.NODE_ENV === "test"
    ? ":memory:"
    : fileURLToPath(new URL("../clinic.sqlite", import.meta.url));
const database = createSqliteDatabase(databasePath);
migrateDatabase(
  database,
  fileURLToPath(new URL("../drizzle", import.meta.url)),
);

const app = createApp(createApplicationDependencies(database));

export default app;
