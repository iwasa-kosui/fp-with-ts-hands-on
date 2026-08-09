import { randomUUID } from "node:crypto";

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
import {
  createAppointmentByIdResolver,
  createAppointmentByPetIdResolver,
  createAppointmentListResolver,
} from "./adaptor/secondary/sqlite/resolver/appointmentResolver.js";
import { createFollowUpResolver } from "./adaptor/secondary/sqlite/resolver/followUpResolver.js";
import {
  createOwnerByIdResolver,
  createOwnerListResolver,
} from "./adaptor/secondary/sqlite/resolver/ownerResolver.js";
import {
  createPetByIdResolver,
  createPetByOwnerIdResolver,
  createPetListResolver,
} from "./adaptor/secondary/sqlite/resolver/petResolver.js";
import { createInstallationStatusQuery } from "./adaptor/secondary/sqlite/query/installationStatusQuery.js";
import { createEventHistoryReader } from "./adaptor/secondary/sqlite/query/eventHistoryReader.js";
import { createFollowUpRequestReader } from "./adaptor/secondary/sqlite/query/followUpRequestReader.js";
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
import { createInitialAdminSetupStore } from "./adaptor/secondary/sqlite/store/initialAdminSetupStore.js";
import {
  createUserDeletedEventStore,
  createUserEventStore,
} from "./adaptor/secondary/sqlite/store/userEventStore.js";
import {
  createOwnerDeletedEventStore,
  createOwnerEventStore,
} from "./adaptor/secondary/sqlite/store/ownerEventStore.js";
import {
  createPetDeletedEventStore,
  createPetEventStore,
} from "./adaptor/secondary/sqlite/store/petEventStore.js";
import { createAppointmentEventStore } from "./adaptor/secondary/sqlite/store/appointmentEventStore.js";
import { createExaminationCompletionStore } from "./adaptor/secondary/sqlite/store/examinationCompletionStore.js";
import { createFollowUpEventStore } from "./adaptor/secondary/sqlite/store/followUpEventStore.js";
import { createAuthenticationMiddleware } from "./adaptor/primary/web/middleware/authentication.js";
import { createSharedPropsMiddleware } from "./adaptor/primary/web/middleware/sharedProps.js";
import { createViteHtmlMiddleware } from "./adaptor/primary/web/middleware/viteHtml.js";
import type { WebEnvironment } from "./adaptor/primary/web/pageProps.js";
import { createRootView } from "./adaptor/primary/web/rootView.js";
import { registerAuthRoutes } from "./adaptor/primary/web/routes/authRoutes.js";
import { registerAppointmentRoutes } from "./adaptor/primary/web/routes/appointmentRoutes.js";
import { registerDashboardRoutes } from "./adaptor/primary/web/routes/dashboardRoutes.js";
import { registerEventRoutes } from "./adaptor/primary/web/routes/eventRoutes.js";
import { registerFollowUpRoutes } from "./adaptor/primary/web/routes/followUpRoutes.js";
import { registerOwnerRoutes } from "./adaptor/primary/web/routes/ownerRoutes.js";
import { registerPetRoutes } from "./adaptor/primary/web/routes/petRoutes.js";
import { registerReceptionRoutes } from "./adaptor/primary/web/routes/receptionRoutes.js";
import { registerUserRoutes } from "./adaptor/primary/web/routes/userRoutes.js";
import type { Clock } from "./domain/aggregate/clock.js";
import { EventId } from "./domain/aggregate/eventId.js";
import type { EventIdGenerator } from "./domain/aggregate/eventIdGenerator.js";
import { Timestamp } from "./domain/aggregate/timestamp.js";
import { AppointmentId } from "./domain/appointment/appointmentId.js";
import { VeterinarianId } from "./domain/appointment/veterinarianId.js";
import { ExamId } from "./domain/examResult/examId.js";
import { OwnerId } from "./domain/owner/ownerId.js";
import { PetId } from "./domain/pet/petId.js";
import type { SessionByTokenHashResolver } from "./domain/session/sessionResolver.js";
import { SessionId } from "./domain/session/sessionId.js";
import { PasswordHash } from "./domain/user/passwordHash.js";
import type { UserByIdResolver } from "./domain/user/userResolver.js";
import { UserId } from "./domain/user/userId.js";
import { CreateOwnerUseCase, type CreateOwnerUseCase as CreateOwner } from "./useCase/createOwnerUseCase.js";
import { CreatePetUseCase, type CreatePetUseCase as CreatePet } from "./useCase/createPetUseCase.js";
import { CreateUserUseCase, type CreateUserUseCase as CreateUser } from "./useCase/createUserUseCase.js";
import { BookAppointmentUseCase, type BookAppointmentUseCase as BookAppointment } from "./useCase/bookAppointmentUseCase.js";
import { CancelAppointmentUseCase, type CancelAppointmentUseCase as CancelAppointment } from "./useCase/cancelAppointmentUseCase.js";
import { CheckInAppointmentUseCase, type CheckInAppointmentUseCase as CheckInAppointment } from "./useCase/checkInAppointmentUseCase.js";
import { DeleteOwnerUseCase, type DeleteOwnerUseCase as DeleteOwner } from "./useCase/deleteOwnerUseCase.js";
import { DeletePetUseCase, type DeletePetUseCase as DeletePet } from "./useCase/deletePetUseCase.js";
import { DeleteUserUseCase, type DeleteUserUseCase as DeleteUser } from "./useCase/deleteUserUseCase.js";
import { GetOwnerUseCase, type GetOwnerUseCase as GetOwner } from "./useCase/getOwnerUseCase.js";
import { GetPetUseCase, type GetPetUseCase as GetPet } from "./useCase/getPetUseCase.js";
import { GetAppointmentUseCase, type GetAppointmentUseCase as GetAppointment } from "./useCase/getAppointmentUseCase.js";
import type { InstallationStatusQuery } from "./useCase/query/installationStatusQuery.js";
import { GetDashboardUseCase, type GetDashboardUseCase as GetDashboard } from "./useCase/getDashboardUseCase.js";
import { ListOwnersUseCase, type ListOwnersUseCase as ListOwners } from "./useCase/listOwnersUseCase.js";
import { ListPetsUseCase, type ListPetsUseCase as ListPets } from "./useCase/listPetsUseCase.js";
import { ListAppointmentsUseCase, type ListAppointmentsUseCase as ListAppointments } from "./useCase/listAppointmentsUseCase.js";
import { ListEventsUseCase, type ListEventsUseCase as ListEvents } from "./useCase/listEventsUseCase.js";
import { ListFollowUpsUseCase, type ListFollowUpsUseCase as ListFollowUps } from "./useCase/listFollowUpsUseCase.js";
import { ListUsersUseCase, type ListUsersUseCase as ListUsers } from "./useCase/listUsersUseCase.js";
import { LogInUseCase, type LogInUseCase as LogIn } from "./useCase/logInUseCase.js";
import { LogOutUseCase, type LogOutUseCase as LogOut } from "./useCase/logOutUseCase.js";
import { RecordExamResultUseCase, type RecordExamResultUseCase as RecordExamResult } from "./useCase/recordExamResultUseCase.js";
import { RecordPaymentUseCase, type RecordPaymentUseCase as RecordPayment } from "./useCase/recordPaymentUseCase.js";
import { RequestFollowUpUseCase, type RequestFollowUpUseCase as RequestFollowUp } from "./useCase/requestFollowUpUseCase.js";
import { ResetUserPasswordUseCase, type ResetUserPasswordUseCase as ResetUserPassword } from "./useCase/resetUserPasswordUseCase.js";
import {
  SetUpInitialAdminUseCase,
  type SetUpInitialAdminUseCase as SetUpInitialAdmin,
} from "./useCase/setUpInitialAdminUseCase.js";
import { UpdateOwnerUseCase, type UpdateOwnerUseCase as UpdateOwner } from "./useCase/updateOwnerUseCase.js";
import { UpdatePetUseCase, type UpdatePetUseCase as UpdatePet } from "./useCase/updatePetUseCase.js";
import { UpdateUserUseCase, type UpdateUserUseCase as UpdateUser } from "./useCase/updateUserUseCase.js";
import { StartExaminationUseCase, type StartExaminationUseCase as StartExamination } from "./useCase/startExaminationUseCase.js";
import { UpdateAppointmentUseCase, type UpdateAppointmentUseCase as UpdateAppointment } from "./useCase/updateAppointmentUseCase.js";
import { RegisterWalkInUseCase, type RegisterWalkInUseCase as RegisterWalkIn } from "./useCase/registerWalkInUseCase.js";
import { ReassignAppointmentVeterinarianUseCase, type ReassignAppointmentVeterinarianUseCase as ReassignAppointmentVeterinarian } from "./useCase/reassignAppointmentVeterinarianUseCase.js";
import { ListVeterinariansUseCase, type ListVeterinariansUseCase as ListVeterinarians } from "./useCase/listVeterinariansUseCase.js";

export type ApplicationDependencies = Readonly<{
  sessionByTokenHashResolver: SessionByTokenHashResolver;
  authenticatedUserByIdResolver: UserByIdResolver;
  installationStatusQuery: InstallationStatusQuery;
  setUpInitialAdmin: SetUpInitialAdmin;
  logIn: LogIn;
  logOut: LogOut;
  getDashboard: GetDashboard;
  listUsers: ListUsers;
  createUser: CreateUser;
  updateUser: UpdateUser;
  resetUserPassword: ResetUserPassword;
  deleteUser: DeleteUser;
  listOwners: ListOwners;
  getOwner: GetOwner;
  createOwner: CreateOwner;
  updateOwner: UpdateOwner;
  deleteOwner: DeleteOwner;
  listPets: ListPets;
  getPet: GetPet;
  createPet: CreatePet;
  updatePet: UpdatePet;
  deletePet: DeletePet;
  listAppointments: ListAppointments;
  getAppointment: GetAppointment;
  bookAppointment: BookAppointment;
  updateAppointment: UpdateAppointment;
  registerWalkIn: RegisterWalkIn;
  reassignAppointmentVeterinarian: ReassignAppointmentVeterinarian;
  listVeterinarians: ListVeterinarians;
  checkInAppointment: CheckInAppointment;
  startExamination: StartExamination;
  recordExamResult: RecordExamResult;
  recordPayment: RecordPayment;
  cancelAppointment: CancelAppointment;
  listFollowUps: ListFollowUps;
  requestFollowUp: RequestFollowUp;
  listEvents: ListEvents;
  clock: Clock;
  isProduction: boolean;
}>;

type CompositionOptions = Readonly<{
  clock?: Clock;
  isProduction: boolean;
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
const veterinarianIdGenerator = {
  generate: () => VeterinarianId.schema.parse(randomUUID()),
} as const;
const ownerIdGenerator = {
  generate: () => OwnerId.schema.parse(randomUUID()),
} as const;
const petIdGenerator = {
  generate: () => PetId.schema.parse(randomUUID()),
} as const;
const appointmentIdGenerator = {
  generate: () => AppointmentId.schema.parse(randomUUID()),
} as const;
const examIdGenerator = {
  generate: () => ExamId.schema.parse(randomUUID()),
} as const;
const dummyPasswordHash = PasswordHash.schema.parse(
  `scrypt$${"D".repeat(22)}==$${"E".repeat(86)}==`,
);

export const createApplicationDependencies = (
  database: SqliteDatabase,
  options: CompositionOptions,
): ApplicationDependencies => {
  const clock = options.clock ?? systemClock;

  const sessionByTokenHashResolver =
    createSessionByTokenHashResolver(database);
  const sessionByIdResolver = createSessionByIdResolver(database);
  const authenticatedUserByIdResolver = createUserByIdResolver(database);
  const installationStatusQuery = createInstallationStatusQuery(database);
  const loginUserByEmailResolver = createUserByEmailResolver(database);
  const dashboardUserByIdResolver = createUserByIdResolver(database);
  const dashboardUserListResolver = createUserListResolver(database);
  const appointmentListResolver = createAppointmentListResolver(database);
  const ownerListResolver = createOwnerListResolver(database);
  const petListResolver = createPetListResolver(database);
  const managementUserByIdResolver = createUserByIdResolver(database);
  const managementUserByEmailResolver = createUserByEmailResolver(database);
  const managementUserListResolver = createUserListResolver(database);
  const managementOwnerByIdResolver = createOwnerByIdResolver(database);
  const managementOwnerListResolver = createOwnerListResolver(database);
  const managementPetByIdResolver = createPetByIdResolver(database);
  const managementPetByOwnerIdResolver = createPetByOwnerIdResolver(database);
  const managementPetListResolver = createPetListResolver(database);
  const managementAppointmentByPetIdResolver =
    createAppointmentByPetIdResolver(database);
  const clinicAppointmentByIdResolver = createAppointmentByIdResolver(database);
  const clinicAppointmentListResolver = createAppointmentListResolver(database);
  const clinicOwnerByIdResolver = createOwnerByIdResolver(database);
  const clinicOwnerListResolver = createOwnerListResolver(database);
  const clinicPetByIdResolver = createPetByIdResolver(database);
  const clinicPetListResolver = createPetListResolver(database);
  const clinicUserByIdResolver = createUserByIdResolver(database);
  const clinicUserListResolver = createUserListResolver(database);
  const followUpResolver = createFollowUpResolver(database);
  const followUpRequestReader = createFollowUpRequestReader(database);
  const eventHistoryReader = createEventHistoryReader(database);
  const sessionEventStore = createSessionEventStore(database);
  const initialAdminSetupStore = createInitialAdminSetupStore(database);
  const userEventStore = createUserEventStore(database);
  const userDeletedEventStore = createUserDeletedEventStore(database);
  const ownerEventStore = createOwnerEventStore(database);
  const ownerDeletedEventStore = createOwnerDeletedEventStore(database);
  const petEventStore = createPetEventStore(database);
  const petDeletedEventStore = createPetDeletedEventStore(database);
  const appointmentEventStore = createAppointmentEventStore(database);
  const examinationCompletionStore = createExaminationCompletionStore(database);
  const followUpEventStore = createFollowUpEventStore(database);

  return {
    sessionByTokenHashResolver,
    authenticatedUserByIdResolver,
    installationStatusQuery,
    setUpInitialAdmin: SetUpInitialAdminUseCase.create({
      initialAdminSetupStore,
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
    listUsers: ListUsersUseCase.create({
      userByIdResolver: managementUserByIdResolver,
      userListResolver: managementUserListResolver,
    }),
    createUser: CreateUserUseCase.create({
      userByIdResolver: managementUserByIdResolver,
      userByEmailResolver: managementUserByEmailResolver,
      userCreatedStore: userEventStore,
      passwordHasher: scryptPasswordHasher,
      clock,
      eventIdGenerator,
      userIdGenerator,
      veterinarianIdGenerator,
    }),
    updateUser: UpdateUserUseCase.create({
      userByIdResolver: managementUserByIdResolver,
      userByEmailResolver: managementUserByEmailResolver,
      userUpdatedStore: userEventStore,
      clock,
      eventIdGenerator,
      veterinarianIdGenerator,
    }),
    resetUserPassword: ResetUserPasswordUseCase.create({
      userResolver: managementUserByIdResolver,
      userPasswordResetStore: userEventStore,
      passwordHasher: scryptPasswordHasher,
      clock,
      eventIdGenerator,
    }),
    deleteUser: DeleteUserUseCase.create({
      userByIdResolver: managementUserByIdResolver,
      userListResolver: managementUserListResolver,
      userDeletedStore: userDeletedEventStore,
      clock,
      eventIdGenerator,
    }),
    listOwners: ListOwnersUseCase.create({
      userResolver: managementUserByIdResolver,
      ownerResolver: managementOwnerListResolver,
    }),
    getOwner: GetOwnerUseCase.create({
      userResolver: managementUserByIdResolver,
      ownerResolver: managementOwnerByIdResolver,
    }),
    createOwner: CreateOwnerUseCase.create({
      userResolver: managementUserByIdResolver,
      ownerCreatedStore: ownerEventStore,
      ownerIdGenerator,
      clock,
      eventIdGenerator,
    }),
    updateOwner: UpdateOwnerUseCase.create({
      userResolver: managementUserByIdResolver,
      ownerResolver: managementOwnerByIdResolver,
      ownerUpdatedStore: ownerEventStore,
      clock,
      eventIdGenerator,
    }),
    deleteOwner: DeleteOwnerUseCase.create({
      userResolver: managementUserByIdResolver,
      ownerResolver: managementOwnerByIdResolver,
      petResolver: managementPetByOwnerIdResolver,
      ownerDeletedStore: ownerDeletedEventStore,
      clock,
      eventIdGenerator,
    }),
    listPets: ListPetsUseCase.create({
      userResolver: managementUserByIdResolver,
      petResolver: managementPetListResolver,
    }),
    getPet: GetPetUseCase.create({
      userResolver: managementUserByIdResolver,
      petResolver: managementPetByIdResolver,
    }),
    createPet: CreatePetUseCase.create({
      userResolver: managementUserByIdResolver,
      ownerResolver: managementOwnerByIdResolver,
      petCreatedStore: petEventStore,
      petIdGenerator,
      clock,
      eventIdGenerator,
    }),
    updatePet: UpdatePetUseCase.create({
      userResolver: managementUserByIdResolver,
      petResolver: managementPetByIdResolver,
      petUpdatedStore: petEventStore,
      clock,
      eventIdGenerator,
    }),
    deletePet: DeletePetUseCase.create({
      userResolver: managementUserByIdResolver,
      petResolver: managementPetByIdResolver,
      appointmentResolver: managementAppointmentByPetIdResolver,
      petDeletedStore: petDeletedEventStore,
      clock,
      eventIdGenerator,
    }),
    listAppointments: ListAppointmentsUseCase.create({
      userResolver: clinicUserByIdResolver,
      appointmentListResolver: clinicAppointmentListResolver,
      ownerListResolver: clinicOwnerListResolver,
      petListResolver: clinicPetListResolver,
      userListResolver: clinicUserListResolver,
    }),
    getAppointment: GetAppointmentUseCase.create({
      userResolver: clinicUserByIdResolver,
      appointmentResolver: clinicAppointmentByIdResolver,
      ownerResolver: clinicOwnerByIdResolver,
      petResolver: clinicPetByIdResolver,
      veterinarianResolver: clinicUserListResolver,
    }),
    bookAppointment: BookAppointmentUseCase.create({
      userResolver: clinicUserByIdResolver,
      ownerResolver: clinicOwnerByIdResolver,
      petResolver: clinicPetByIdResolver,
      userListResolver: clinicUserListResolver,
      appointmentBookedStore: appointmentEventStore,
      appointmentIdGenerator,
      clock,
      eventIdGenerator,
    }),
    updateAppointment: UpdateAppointmentUseCase.create({
      userResolver: clinicUserByIdResolver,
      userListResolver: clinicUserListResolver,
      ownerResolver: clinicOwnerByIdResolver,
      petResolver: clinicPetByIdResolver,
      appointmentResolver: clinicAppointmentByIdResolver,
      appointmentUpdatedStore: appointmentEventStore,
      clock,
      eventIdGenerator,
    }),
    registerWalkIn: RegisterWalkInUseCase.create({
      userResolver: clinicUserByIdResolver,
      userListResolver: clinicUserListResolver,
      ownerResolver: clinicOwnerByIdResolver,
      petResolver: clinicPetByIdResolver,
      appointmentWalkInRegisteredStore: appointmentEventStore,
      appointmentIdGenerator,
      clock,
      eventIdGenerator,
    }),
    reassignAppointmentVeterinarian: ReassignAppointmentVeterinarianUseCase.create({
      userResolver: clinicUserByIdResolver,
      userListResolver: clinicUserListResolver,
      appointmentResolver: clinicAppointmentByIdResolver,
      appointmentVeterinarianReassignedStore: appointmentEventStore,
      clock,
      eventIdGenerator,
    }),
    listVeterinarians: ListVeterinariansUseCase.create({
      userResolver: clinicUserByIdResolver,
      userListResolver: clinicUserListResolver,
    }),
    checkInAppointment: CheckInAppointmentUseCase.create({
      userResolver: clinicUserByIdResolver,
      appointmentResolver: clinicAppointmentByIdResolver,
      appointmentCheckedInStore: appointmentEventStore,
      clock,
      eventIdGenerator,
    }),
    startExamination: StartExaminationUseCase.create({
      userResolver: clinicUserByIdResolver,
      appointmentResolver: clinicAppointmentByIdResolver,
      examinationStartedStore: appointmentEventStore,
      clock,
      eventIdGenerator,
    }),
    recordExamResult: RecordExamResultUseCase.create({
      userResolver: clinicUserByIdResolver,
      appointmentResolver: clinicAppointmentByIdResolver,
      examinationCompletionStore,
      examIdGenerator,
      clock,
      eventIdGenerator,
    }),
    recordPayment: RecordPaymentUseCase.create({
      userResolver: clinicUserByIdResolver,
      appointmentResolver: clinicAppointmentByIdResolver,
      paymentRecordedStore: appointmentEventStore,
      clock,
      eventIdGenerator,
    }),
    cancelAppointment: CancelAppointmentUseCase.create({
      userResolver: clinicUserByIdResolver,
      appointmentResolver: clinicAppointmentByIdResolver,
      appointmentCanceledStore: appointmentEventStore,
      clock,
      eventIdGenerator,
    }),
    listFollowUps: ListFollowUpsUseCase.create({
      userResolver: clinicUserByIdResolver,
      followUpResolver,
      followUpRequestReader,
    }),
    requestFollowUp: RequestFollowUpUseCase.create({
      userResolver: clinicUserByIdResolver,
      followUpResolver,
      followUpRequestReader,
      followUpRequestedStore: followUpEventStore,
      eventIdGenerator,
      clock,
    }),
    listEvents: ListEventsUseCase.create({
      userResolver: clinicUserByIdResolver,
      eventHistoryReader,
    }),
    clock,
    isProduction: options.isProduction,
  };
};

export const createApp = (dependencies: ApplicationDependencies) => {
  const app = new Hono<WebEnvironment>();

  app.use("*", secureHeaders());
  app.use("*", csrf());
  app.use("*", createViteHtmlMiddleware(dependencies.isProduction));
  app.use(
    "*",
    inertia({ version: "1", rootView: createRootView(dependencies.isProduction) }),
  );
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
    installationStatusQuery: dependencies.installationStatusQuery,
    setUpInitialAdmin: dependencies.setUpInitialAdmin,
    logIn: dependencies.logIn,
    logOut: dependencies.logOut,
    clock: dependencies.clock,
    isProduction: dependencies.isProduction,
  });
  registerDashboardRoutes(app, {
    installationStatusQuery: dependencies.installationStatusQuery,
    getDashboard: dependencies.getDashboard,
  });
  registerUserRoutes(app, {
    listUsers: dependencies.listUsers,
    createUser: dependencies.createUser,
    updateUser: dependencies.updateUser,
    resetUserPassword: dependencies.resetUserPassword,
    deleteUser: dependencies.deleteUser,
  });
  registerOwnerRoutes(app, {
    listOwners: dependencies.listOwners,
    getOwner: dependencies.getOwner,
    createOwner: dependencies.createOwner,
    updateOwner: dependencies.updateOwner,
    deleteOwner: dependencies.deleteOwner,
  });
  registerPetRoutes(app, {
    listPets: dependencies.listPets,
    getPet: dependencies.getPet,
    createPet: dependencies.createPet,
    updatePet: dependencies.updatePet,
    deletePet: dependencies.deletePet,
    listOwners: dependencies.listOwners,
  });
  registerAppointmentRoutes(app, {
    listAppointments: dependencies.listAppointments,
    getAppointment: dependencies.getAppointment,
    bookAppointment: dependencies.bookAppointment,
    checkInAppointment: dependencies.checkInAppointment,
    startExamination: dependencies.startExamination,
    recordExamResult: dependencies.recordExamResult,
    recordPayment: dependencies.recordPayment,
    cancelAppointment: dependencies.cancelAppointment,
    listOwners: dependencies.listOwners,
    listPets: dependencies.listPets,
    listVeterinarians: dependencies.listVeterinarians,
    updateAppointment: dependencies.updateAppointment,
    reassignAppointmentVeterinarian: dependencies.reassignAppointmentVeterinarian,
  });
  registerReceptionRoutes(app, {
    listOwners: dependencies.listOwners,
    listPets: dependencies.listPets,
    listVeterinarians: dependencies.listVeterinarians,
    registerWalkIn: dependencies.registerWalkIn,
  });
  registerFollowUpRoutes(app, {
    listFollowUps: dependencies.listFollowUps,
    requestFollowUp: dependencies.requestFollowUp,
  });
  registerEventRoutes(app, { listEvents: dependencies.listEvents });

  app.onError((error) =>
    error instanceof HTTPException
      ? error.getResponse()
      : new Response("Internal Server Error", { status: 500 }),
  );
  return app;
};

export type DatabaseBackedApplicationOptions = Readonly<{
  databasePath: string;
  migrationsFolder: string;
  isProduction: boolean;
}>;

export const createDatabaseBackedApp = (
  options: DatabaseBackedApplicationOptions,
) => {
  const database = createSqliteDatabase(options.databasePath);
  migrateDatabase(database, options.migrationsFolder);
  return createApp(
    createApplicationDependencies(database, {
      isProduction: options.isProduction,
    }),
  );
};
