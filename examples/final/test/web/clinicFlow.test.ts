import { eq } from "drizzle-orm";
import { objectToFormData } from "@inertiajs/core";
import { describe, expect, test } from "vitest";
import { errAsync, okAsync } from "neverthrow";

import { createSqliteDatabase, migrateDatabase } from "../../src/adaptor/secondary/sqlite/db.js";
import {
  appointmentsTable,
  domainEventsTable,
  examResultsTable,
  ownersTable,
  petsTable,
  usersTable,
} from "../../src/adaptor/secondary/sqlite/schema.js";
import { Timestamp } from "../../src/domain/aggregate/timestamp.js";
import { EventId } from "../../src/domain/aggregate/eventId.js";
import { AppointmentId } from "../../src/domain/appointment/index.js";
import { createUserByIdResolver } from "../../src/adaptor/secondary/sqlite/resolver/userResolver.js";
import { createFollowUpResolver } from "../../src/adaptor/secondary/sqlite/resolver/followUpResolver.js";
import { createFollowUpEventStore } from "../../src/adaptor/secondary/sqlite/store/followUpEventStore.js";
import { RequestFollowUpUseCase } from "../../src/useCase/requestFollowUpUseCase.js";
import {
  createApp,
  createApplicationDependencies,
} from "../../src/app.js";

const inertiaHeaders = {
  Accept: "application/json",
  "X-Inertia": "true",
  "X-Inertia-Version": "1",
} as const;
const admin = {
  email: "admin@example.test",
  name: "Clinic Admin",
  password: "correct horse battery staple",
} as const;
const receptionist = {
  email: "reception@example.test",
  name: "Clinic Reception",
  password: "reception password value",
} as const;
const veterinarian = {
  email: "vet@example.test",
  name: "Clinic Vet",
  password: "veterinarian password value",
} as const;

const createHarness = () => {
  let currentTime = Timestamp.schema.parse("2026-08-09T01:30:00.000Z");
  const database = createSqliteDatabase(":memory:");
  migrateDatabase(database);
  const dependencies = createApplicationDependencies(database, {
    clock: { now: () => currentTime },
    isProduction: false,
  });
  const app = createApp(dependencies);
  return {
    app,
    database,
    dependencies,
    setTime: (value: string) => {
      currentTime = Timestamp.schema.parse(value);
    },
  } as const;
};
type Harness = ReturnType<typeof createHarness>;

const cookiePair = (response: Response): string => {
  const cookie = response.headers.get("set-cookie");
  expect(cookie).not.toBeNull();
  return cookie?.split(";")[0] ?? "";
};
const post = (
  harness: Harness,
  path: string,
  values: Readonly<Record<string, string>>,
  cookie?: string,
) =>
  harness.app.request(path, {
    method: "POST",
    body: new URLSearchParams(values),
    headers: {
      ...inertiaHeaders,
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: "http://localhost",
      ...(cookie === undefined ? {} : { Cookie: cookie }),
    },
  });
const postInertiaFormData = (
  harness: Harness,
  path: string,
  values: Parameters<typeof objectToFormData>[0],
  cookie: string,
) =>
  harness.app.request(path, {
    method: "POST",
    body: objectToFormData(values),
    headers: {
      ...inertiaHeaders,
      Origin: "http://localhost",
      Cookie: cookie,
    },
  });
const page = (harness: Harness, path: string, cookie: string) =>
  harness.app.request(path, {
    headers: { ...inertiaHeaders, Cookie: cookie },
  });
const setup = async (harness: Harness): Promise<string> =>
  cookiePair(await post(harness, "/setup", admin));
const login = async (
  harness: Harness,
  credentials: Readonly<{ email: string; password: string }>,
): Promise<string> => cookiePair(await post(harness, "/login", credentials));
const createUser = async (
  harness: Harness,
  adminCookie: string,
  values: Readonly<{
    email: string;
    name: string;
    password: string;
    role: "Receptionist" | "Veterinarian";
  }>,
) => {
  const response = await post(harness, "/users", values, adminCookie);
  expect(response.status).toBe(302);
  return harness.database
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, values.email))
    .get();
};
const createOwnerAndPet = async (harness: Harness, cookie: string) => {
  expect(
    (await post(
      harness,
      "/owners",
      {
        name: "Hanako Owner",
        email: "hanako.owner@example.test",
        phone: "090-1234-5678",
      },
      cookie,
    )).status,
  ).toBe(302);
  const owner = harness.database.select().from(ownersTable).get();
  expect(owner).toBeDefined();
  if (owner === undefined) throw new TypeError("owner was not created");
  expect(
    (await post(
      harness,
      "/pets",
      { ownerId: owner.ownerId, name: "Mugi", species: "Cat" },
      cookie,
    )).status,
  ).toBe(302);
  const pet = harness.database.select().from(petsTable).get();
  expect(pet).toBeDefined();
  if (pet === undefined) throw new TypeError("pet was not created");
  return { owner, pet } as const;
};

describe("clinic workflow routes", () => {
  test("drives booking through payment and exposes only state-valid actions", async () => {
    const harness = createHarness();
    const adminCookie = await setup(harness);
    const receptionistRow = await createUser(harness, adminCookie, {
      ...receptionist,
      role: "Receptionist",
    });
    const veterinarianRow = await createUser(harness, adminCookie, {
      ...veterinarian,
      role: "Veterinarian",
    });
    expect(receptionistRow).toBeDefined();
    expect(veterinarianRow?.veterinarianId).not.toBeNull();
    if (veterinarianRow?.veterinarianId === null || veterinarianRow === undefined) {
      throw new TypeError("veterinarian was not created");
    }
    const receptionistCookie = await login(harness, receptionist);
    const veterinarianCookie = await login(harness, veterinarian);
    const { owner, pet } = await createOwnerAndPet(
      harness,
      receptionistCookie,
    );

    const newPage = await page(harness, "/appointments/new", receptionistCookie);
    await expect(newPage.json()).resolves.toMatchObject({
      component: "Appointments/New",
      props: {
        owners: [{ ownerId: owner.ownerId, name: "Hanako Owner" }],
        pets: [{ petId: pet.petId, ownerId: owner.ownerId, name: "Mugi" }],
      },
    });

    const booked = await post(
      harness,
      "/appointments",
      {
        ownerId: owner.ownerId,
        petId: pet.petId,
        scheduledAt: "2026-08-10T03:00:00.000Z",
        reason: "Annual checkup",
      },
      receptionistCookie,
    );
    const appointment = harness.database.select().from(appointmentsTable).get();
    expect(appointment).toBeDefined();
    if (appointment === undefined) throw new TypeError("appointment was not booked");
    expect(booked.status).toBe(303);
    expect(booked.headers.get("location")).toBe(
      `/appointments/${appointment.appointmentId}`,
    );

    const scheduled = await page(
      harness,
      `/appointments/${appointment.appointmentId}`,
      receptionistCookie,
    );
    await expect(scheduled.json()).resolves.toMatchObject({
      component: "Appointments/Show",
      props: {
        appointment: { kind: "Scheduled", ownerName: "Hanako Owner", petName: "Mugi" },
        actions: { checkIn: true, cancel: true, startExamination: false, recordExamResult: false, recordPayment: false },
      },
    });

    expect(
      (await post(
        harness,
        `/appointments/${appointment.appointmentId}/check-in`,
        {},
        receptionistCookie,
      )).status,
    ).toBe(303);
    const checkedIn = await page(
      harness,
      `/appointments/${appointment.appointmentId}`,
      veterinarianCookie,
    );
    await expect(checkedIn.json()).resolves.toMatchObject({
      props: {
        appointment: { kind: "CheckedIn" },
        actions: { checkIn: false, cancel: false, startExamination: true, recordExamResult: false, recordPayment: false },
      },
    });

    expect(
      (await post(
        harness,
        `/appointments/${appointment.appointmentId}/start-examination`,
        {},
        veterinarianCookie,
      )).status,
    ).toBe(303);
    const examining = await page(
      harness,
      `/appointments/${appointment.appointmentId}`,
      veterinarianCookie,
    );
    await expect(examining.json()).resolves.toMatchObject({
      props: {
        appointment: { kind: "InExamination", veterinarianName: "Clinic Vet" },
        actions: { checkIn: false, cancel: false, startExamination: false, recordExamResult: true, recordPayment: false },
      },
    });
    const adminExamining = await page(
      harness,
      `/appointments/${appointment.appointmentId}`,
      adminCookie,
    );
    await expect(adminExamining.json()).resolves.toMatchObject({
      props: {
        actions: {
          checkIn: false,
          cancel: false,
          startExamination: false,
          recordExamResult: true,
          recordPayment: false,
        },
        veterinarians: [{
          veterinarianId: veterinarianRow.veterinarianId,
          name: "Clinic Vet",
        }],
      },
    });

    harness.setTime("2026-08-09T02:00:00.000Z");
    const invalidFollowUpFlag = await post(
      harness,
      `/appointments/${appointment.appointmentId}/exam-results`,
      {
        petId: pet.petId,
        collectedAt: "2026-08-09T02:00:00.000Z",
        item: "Do not store this result",
        needsFollowUp: "definitely",
      },
      veterinarianCookie,
    );
    await expect(invalidFollowUpFlag.json()).resolves.toMatchObject({
      component: "Appointments/Show",
      props: { errors: { needsFollowUp: expect.any(String) } },
    });
    expect(harness.database.select().from(examResultsTable).all()).toHaveLength(0);

    const noFollowUp = await postInertiaFormData(
      harness,
      `/appointments/${appointment.appointmentId}/exam-results`,
      {
        petId: pet.petId,
        collectedAt: "2026-08-09T02:00:00.000Z",
        item: "Routine finding",
        needsFollowUp: false,
      },
      veterinarianCookie,
    );
    expect(noFollowUp.status).toBe(303);
    expect(harness.database.select().from(examResultsTable).all()).toHaveLength(1);
    const awaitingPayment = await page(
      harness,
      `/appointments/${appointment.appointmentId}`,
      receptionistCookie,
    );
    await expect(awaitingPayment.json()).resolves.toMatchObject({
      props: {
        appointment: { kind: "AwaitingPayment" },
        actions: {
          checkIn: false,
          cancel: false,
          startExamination: false,
          recordExamResult: false,
          recordPayment: true,
        },
      },
    });
    const veterinarianAwaitingPayment = await page(
      harness,
      `/appointments/${appointment.appointmentId}`,
      veterinarianCookie,
    );
    await expect(veterinarianAwaitingPayment.json()).resolves.toMatchObject({
      props: {
        appointment: { kind: "AwaitingPayment" },
        actions: { recordExamResult: false, recordPayment: false },
      },
    });

    const staleExamResult = await postInertiaFormData(
      harness,
      `/appointments/${appointment.appointmentId}/exam-results`,
      {
        petId: pet.petId,
        collectedAt: "2026-08-09T02:00:00.000Z",
        item: "Highly sensitive clinical finding",
        needsFollowUp: true,
      },
      veterinarianCookie,
    );
    expect(staleExamResult.status).toBe(303);
    expect(staleExamResult.headers.get("location")).toContain(
      "error=invalid-state",
    );
    expect(harness.database.select().from(examResultsTable).all()).toHaveLength(1);

    harness.setTime("2026-08-09T02:30:00.000Z");
    const paid = await post(
      harness,
      `/appointments/${appointment.appointmentId}/payment`,
      { diagnosis: "Dermatitis", treatment: "Topical care", amount: "12500" },
      receptionistCookie,
    );
    expect(paid.status).toBe(303);
    const paidPage = await page(
      harness,
      `/appointments/${appointment.appointmentId}`,
      receptionistCookie,
    );
    const paidProps = await paidPage.json();
    expect(paidProps).toMatchObject({
      props: {
        appointment: { kind: "Paid", amount: 12500 },
        actions: { checkIn: false, cancel: false, startExamination: false, recordExamResult: false, recordPayment: false },
      },
    });
    expect(JSON.stringify(paidProps)).not.toContain("Dermatitis");
    expect(JSON.stringify(paidProps)).not.toContain("Topical care");
    expect(paidProps.props.appointment).not.toHaveProperty("state");
  });

  test("enforces role boundaries before validation and returns actionable validation/conflict pages", async () => {
    const harness = createHarness();
    const adminCookie = await setup(harness);
    await createUser(harness, adminCookie, {
      ...veterinarian,
      role: "Veterinarian",
    });
    const veterinarianCookie = await login(harness, veterinarian);

    const forbidden = await post(
      harness,
      "/appointments/not-an-id/check-in",
      {},
      veterinarianCookie,
    );
    expect(forbidden.status).toBe(403);
    expect(
      (await post(
        harness,
        "/appointments/not-an-id/payment",
        { diagnosis: "x", treatment: "y", amount: "1" },
        veterinarianCookie,
      )).status,
    ).toBe(403);

    const invalid = await post(
      harness,
      "/appointments",
      {
        ownerId: "ATTACKER_RAW_INVALID_OWNER_ID",
        petId: "ATTACKER_RAW_INVALID_PET_ID",
        scheduledAt: "ATTACKER_RAW_INVALID_TIMESTAMP",
        reason: "",
      },
      adminCookie,
    );
    const invalidPage = await invalid.json();
    expect(invalid.status).toBe(200);
    expect(invalidPage).toMatchObject({
      component: "Appointments/New",
      props: { errors: { ownerId: expect.any(String), petId: expect.any(String), scheduledAt: expect.any(String), reason: expect.any(String) } },
    });
    const invalidBody = JSON.stringify(invalidPage);
    expect(invalidBody).not.toContain("ATTACKER_RAW_INVALID_OWNER_ID");
    expect(invalidBody).not.toContain("ATTACKER_RAW_INVALID_PET_ID");
    expect(invalidBody).not.toContain("ATTACKER_RAW_INVALID_TIMESTAMP");

    const { owner, pet } = await createOwnerAndPet(harness, adminCookie);
    await post(
      harness,
      "/appointments",
      { ownerId: owner.ownerId, petId: pet.petId, scheduledAt: "2026-08-10T03:00:00.000Z", reason: "Vaccination" },
      adminCookie,
    );
    const appointment = harness.database.select().from(appointmentsTable).get();
    if (appointment === undefined) throw new TypeError("appointment was not booked");
    await post(
      harness,
      `/appointments/${appointment.appointmentId}/check-in`,
      {},
      adminCookie,
    );
    const repeated = await post(
      harness,
      `/appointments/${appointment.appointmentId}/check-in`,
      {},
      adminCookie,
    );
    expect(repeated.status).toBe(303);
    expect(repeated.headers.get("location")).toBe(
      `/appointments/${appointment.appointmentId}?error=invalid-state`,
    );
    const conflictPage = await page(
      harness,
      repeated.headers.get("location") ?? "",
      adminCookie,
    );
    await expect(conflictPage.json()).resolves.toMatchObject({
      props: { errors: { form: "現在の予約状態ではこの操作を実行できません。画面を更新して状態を確認してください。" } },
    });

    const conflictAppointmentId = AppointmentId.schema.parse(appointment.appointmentId);
    const authoritativeConflictApp = createApp({
      ...harness.dependencies,
      checkInAppointment: {
        run: () => errAsync({
          kind: "AppointmentConflict" as const,
          appointmentId: conflictAppointmentId,
        }),
      },
    });
    const authoritativeConflict = await authoritativeConflictApp.request(
      `/appointments/${appointment.appointmentId}/check-in`,
      {
        method: "POST",
        body: new URLSearchParams(),
        headers: {
          ...inertiaHeaders,
          "Content-Type": "application/x-www-form-urlencoded",
          Origin: "http://localhost",
          Cookie: adminCookie,
        },
      },
    );
    expect(authoritativeConflict.status).toBe(303);
    expect(authoritativeConflict.headers.get("location")).toBe(
      `/appointments/${appointment.appointmentId}?error=appointment-conflict`,
    );

    const invalidPayment = await post(
      harness,
      `/appointments/${appointment.appointmentId}/payment`,
      { diagnosis: "x", treatment: "y", amount: "0" },
      adminCookie,
    );
    await expect(invalidPayment.json()).resolves.toMatchObject({
      props: { errors: { amount: expect.any(String) } },
    });

    await post(
      harness,
      "/appointments",
      { ownerId: owner.ownerId, petId: pet.petId, scheduledAt: "2026-08-11T03:00:00.000Z", reason: "Cancelable visit" },
      adminCookie,
    );
    const cancelable = harness.database
      .select()
      .from(appointmentsTable)
      .all()
      .find((item) => item.status === "Scheduled");
    if (cancelable === undefined) throw new TypeError("cancelable appointment missing");
    const canceled = await post(
      harness,
      `/appointments/${cancelable.appointmentId}/cancel`,
      { reason: "Owner requested cancellation" },
      adminCookie,
    );
    expect(canceled.status).toBe(303);
    const canceledPage = await page(
      harness,
      `/appointments/${cancelable.appointmentId}`,
      adminCookie,
    );
    const canceledProps = await canceledPage.json();
    expect(canceledProps).toMatchObject({
      props: {
        appointment: { kind: "Canceled" },
        actions: {
          checkIn: false,
          cancel: false,
          startExamination: false,
          recordExamResult: false,
          recordPayment: false,
        },
      },
    });
    expect(JSON.stringify(canceledProps)).not.toContain("Owner requested cancellation");
    expect(canceledProps.props.appointment).not.toHaveProperty("state");
    expect(canceledProps.props.appointment).not.toHaveProperty("reason");
  });

  test("requests follow-ups with fresh event identity and retains deleted relation labels", async () => {
    const harness = createHarness();
    const adminCookie = await setup(harness);
    const vet = await createUser(harness, adminCookie, {
      ...veterinarian,
      role: "Veterinarian",
    });
    if (vet?.veterinarianId === null || vet === undefined) throw new TypeError("vet missing");
    const vetCookie = await login(harness, veterinarian);
    const { owner, pet } = await createOwnerAndPet(harness, adminCookie);
    await post(harness, "/appointments", { ownerId: owner.ownerId, petId: pet.petId, scheduledAt: "2026-08-10T03:00:00.000Z", reason: "Follow-up flow" }, adminCookie);
    const appointment = harness.database.select().from(appointmentsTable).get();
    if (appointment === undefined) throw new TypeError("appointment missing");
    await post(harness, `/appointments/${appointment.appointmentId}/check-in`, {}, adminCookie);
    await post(harness, `/appointments/${appointment.appointmentId}/start-examination`, {}, vetCookie);
    await post(harness, `/appointments/${appointment.appointmentId}/exam-results`, {
      petId: pet.petId,
      collectedAt: "2026-08-09T02:00:00.000Z",
      item: "private result",
      needsFollowUp: "true",
    }, vetCookie);
    harness.setTime("2026-08-09T02:30:00.000Z");
    await post(harness, `/appointments/${appointment.appointmentId}/payment`, { diagnosis: "D", treatment: "T", amount: "1000" }, adminCookie);

    const followUps = await page(harness, "/follow-ups", adminCookie);
    await expect(followUps.json()).resolves.toMatchObject({
      component: "FollowUps/Index",
      props: { followUps: [{ appointmentId: appointment.appointmentId, ownerName: "Hanako Owner", ownerPhone: "090-1234-5678", requested: false }] },
    });
    harness.setTime("2026-08-09T03:00:00.000Z");
    const requested = await post(
      harness,
      "/follow-ups/request",
      { appointmentIds: appointment.appointmentId },
      adminCookie,
    );
    expect(requested.status).toBe(303);
    expect(requested.headers.get("location")).toBe("/follow-ups");
    const paymentEvent = harness.database
      .select()
      .from(domainEventsTable)
      .where(eq(domainEventsTable.eventName, "appointment.payment-recorded"))
      .get();
    const followUpEvent = harness.database
      .select()
      .from(domainEventsTable)
      .where(eq(domainEventsTable.eventName, "follow-up.requested"))
      .get();
    expect(followUpEvent?.eventId).not.toBe(paymentEvent?.eventId);
    expect(followUpEvent?.occurredAt).toBe("2026-08-09T03:00:00.000Z");
    const duplicate = await post(
      harness,
      "/follow-ups/request",
      { appointmentIds: appointment.appointmentId },
      adminCookie,
    );
    expect(duplicate.status).toBe(303);
    expect(duplicate.headers.get("location")).toBe("/follow-ups?error=request-conflict");
    expect(
      harness.database
        .select()
        .from(domainEventsTable)
        .where(eq(domainEventsTable.eventName, "follow-up.requested"))
        .all(),
    ).toHaveLength(1);

    const staleRequestFollowUp = RequestFollowUpUseCase.create({
      userResolver: createUserByIdResolver(harness.database),
      followUpResolver: createFollowUpResolver(harness.database),
      followUpRequestReader: { listRequestedAppointmentIds: () => okAsync([]) },
      followUpRequestedStore: createFollowUpEventStore(harness.database),
      eventIdGenerator: {
        generate: () => EventId.schema.parse("71000000-0000-4000-8000-000000000001"),
      },
      clock: { now: () => Timestamp.schema.parse("2026-08-09T03:30:00.000Z") },
    });
    const staleApp = createApp({
      ...harness.dependencies,
      requestFollowUp: staleRequestFollowUp,
    });
    const stale = await staleApp.request("/follow-ups/request", {
      method: "POST",
      body: new URLSearchParams({ appointmentIds: appointment.appointmentId }),
      headers: {
        ...inertiaHeaders,
        "Content-Type": "application/x-www-form-urlencoded",
        Origin: "http://localhost",
        Cookie: adminCookie,
      },
    });
    expect(stale.status).toBe(303);
    expect(stale.headers.get("location")).toBe("/follow-ups?error=request-conflict");
    expect(
      harness.database
        .select()
        .from(domainEventsTable)
        .where(eq(domainEventsTable.eventName, "follow-up.requested"))
        .all(),
    ).toHaveLength(1);

    expect((await post(harness, `/pets/${pet.petId}/delete`, {}, adminCookie)).status).toBe(302);
    expect((await post(harness, `/owners/${owner.ownerId}/delete`, {}, adminCookie)).status).toBe(302);
    expect((await post(harness, `/users/${vet.userId}/delete`, {}, adminCookie)).status).toBe(302);
    const retained = await page(
      harness,
      `/appointments/${appointment.appointmentId}`,
      adminCookie,
    );
    await expect(retained.json()).resolves.toMatchObject({
      props: { appointment: { ownerName: "削除済み", petName: "削除済み", veterinarianName: "削除済み" } },
    });
  });
});
