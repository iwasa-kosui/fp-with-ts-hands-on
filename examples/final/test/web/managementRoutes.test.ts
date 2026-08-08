import { eq } from "drizzle-orm";
import { errAsync } from "neverthrow";
import { describe, expect, test } from "vitest";

import { createSqliteDatabase, migrateDatabase } from "../../src/adaptor/secondary/sqlite/db.js";
import {
  appointmentsTable,
  domainEventsTable,
  ownersTable,
  petsTable,
  usersTable,
} from "../../src/adaptor/secondary/sqlite/schema.js";
import { Timestamp } from "../../src/domain/aggregate/timestamp.js";
import { OwnerId } from "../../src/domain/owner/ownerId.js";
import { PetId } from "../../src/domain/pet/petId.js";
import {
  createApp,
  createApplicationDependencies,
} from "../../src/app.js";

const now = Timestamp.schema.parse("2026-08-09T01:30:00.000Z");
const clock = { now: () => now } as const;
const adminCredentials = {
  email: "admin@example.test",
  name: "Clinic Admin",
  password: "correct horse battery staple",
} as const;
const receptionistCredentials = {
  email: "reception@example.test",
  name: "Clinic Reception",
  password: "reception password value",
} as const;
const veterinarianCredentials = {
  email: "vet@example.test",
  name: "Clinic Vet",
  password: "veterinarian password value",
} as const;

const inertiaHeaders = {
  Accept: "application/json",
  "X-Inertia": "true",
  "X-Inertia-Version": "1",
} as const;

const createHarness = () => {
  const database = createSqliteDatabase(":memory:");
  migrateDatabase(database);
  const dependencies = createApplicationDependencies(database, {
    clock,
    isProduction: false,
  });
  return {
    app: createApp(dependencies),
    database,
    dependencies,
  } as const;
};

type Harness = ReturnType<typeof createHarness>;

const cookiePair = (response: Response): string => {
  const setCookie = response.headers.get("set-cookie");
  expect(setCookie).not.toBeNull();
  return setCookie?.split(";")[0] ?? "";
};

const requestPage = (harness: Harness, path: string, cookie: string) =>
  harness.app.request(path, {
    headers: { ...inertiaHeaders, Cookie: cookie },
  });

const postForm = (
  harness: Pick<Harness, "app">,
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

const setUp = async (harness: Harness): Promise<string> => {
  const response = await postForm(harness, "/setup", adminCredentials);
  expect(response.status).toBe(302);
  return cookiePair(response);
};

const logIn = async (
  harness: Harness,
  credentials: Readonly<{ email: string; password: string }>,
): Promise<string> => {
  const response = await postForm(harness, "/login", credentials);
  expect(response.status).toBe(302);
  return cookiePair(response);
};

const createUser = async (
  harness: Harness,
  adminCookie: string,
  values: Readonly<{
    email: string;
    name: string;
    password: string;
    role: "Admin" | "Receptionist" | "Veterinarian";
  }>,
) => {
  const response = await postForm(harness, "/users", values, adminCookie);
  expect(response.status).toBe(302);
  expect(response.headers.get("location")).toBe("/users");
  const user = harness.database
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, values.email))
    .get();
  expect(user).toBeDefined();
  return user;
};

describe("management route boundary", () => {
  test("Admin can list, create, update, reset, and physically delete users without exposing secrets", async () => {
    const harness = createHarness();
    const adminCookie = await setUp(harness);
    const receptionist = await createUser(
      harness,
      adminCookie,
      { ...receptionistCredentials, role: "Receptionist" },
    );
    if (receptionist === undefined) return;

    const indexResponse = await requestPage(harness, "/users", adminCookie);
    const indexPage = await indexResponse.json();
    const serializedIndex = JSON.stringify(indexPage);
    expect(indexResponse.status).toBe(200);
    expect(indexPage).toMatchObject({
      component: "Users/Index",
      props: {
        users: expect.arrayContaining([
          {
            userId: receptionist.userId,
            role: "Receptionist",
            email: receptionistCredentials.email,
            name: receptionistCredentials.name,
          },
        ]),
      },
    });
    expect(serializedIndex).not.toContain(receptionist.passwordHash);
    expect(serializedIndex).not.toContain("passwordHash");

    const editResponse = await requestPage(
      harness,
      `/users/${receptionist.userId}/edit`,
      adminCookie,
    );
    const editPage = await editResponse.json();
    expect(editPage).toMatchObject({
      component: "Users/Form",
      props: {
        mode: "edit",
        user: {
          userId: receptionist.userId,
          role: "Receptionist",
          email: receptionistCredentials.email,
          name: receptionistCredentials.name,
        },
      },
    });
    expect(JSON.stringify(editPage)).not.toContain(receptionist.passwordHash);

    const updateResponse = await postForm(
      harness,
      `/users/${receptionist.userId}`,
      {
        email: "updated-reception@example.test",
        name: "Updated Reception",
        role: "Receptionist",
      },
      adminCookie,
    );
    expect(updateResponse.status).toBe(302);
    expect(updateResponse.headers.get("location")).toBe("/users");

    const resetResponse = await postForm(
      harness,
      `/users/${receptionist.userId}/reset-password`,
      { password: "updated reception password" },
      adminCookie,
    );
    expect(resetResponse.status).toBe(302);
    expect(resetResponse.headers.get("location")).toBe("/users");
    await logIn(harness, {
      email: "updated-reception@example.test",
      password: "updated reception password",
    });

    const deleteResponse = await postForm(
      harness,
      `/users/${receptionist.userId}/delete`,
      {},
      adminCookie,
    );
    expect(deleteResponse.status).toBe(302);
    expect(deleteResponse.headers.get("location")).toBe("/users");
    expect(
      harness.database
        .select()
        .from(usersTable)
        .where(eq(usersTable.userId, receptionist.userId))
        .get(),
    ).toBeUndefined();

    const eventNames = harness.database
      .select({ eventName: domainEventsTable.eventName })
      .from(domainEventsTable)
      .all()
      .map(({ eventName }) => eventName);
    expect(eventNames).toEqual(
      expect.arrayContaining([
        "user.created",
        "user.updated",
        "user.password-reset",
        "user.deleted",
      ]),
    );
  });

  test("validates user form data without echoing passwords and maps self/last-admin conflicts safely", async () => {
    const harness = createHarness();
    const adminCookie = await setUp(harness);
    const admin = harness.database.select().from(usersTable).get();
    expect(admin).toBeDefined();
    if (admin === undefined) return;

    const invalidPassword = "short";
    const invalidResponse = await postForm(
      harness,
      "/users",
      {
        email: "not-an-email",
        name: "",
        password: invalidPassword,
        role: "NoSuchRole",
      },
      adminCookie,
    );
    const invalidPage = await invalidResponse.json();
    expect(invalidResponse.status).toBe(200);
    expect(invalidPage).toMatchObject({
      component: "Users/Form",
      props: {
        errors: {
          email: expect.any(String),
          name: expect.any(String),
          password: expect.any(String),
          role: expect.any(String),
        },
      },
    });
    expect(JSON.stringify(invalidPage)).not.toContain(invalidPassword);

    const selfDelete = await postForm(
      harness,
      `/users/${admin.userId}/delete`,
      {},
      adminCookie,
    );
    expect(selfDelete.status).toBe(303);
    expect(selfDelete.headers.get("location")).toBe(
      "/users?error=cannot-delete-self",
    );
    const selfConflictPage = await requestPage(
      harness,
      "/users?error=cannot-delete-self",
      adminCookie,
    );
    const selfConflictProps = await selfConflictPage.json();
    expect(selfConflictProps).toMatchObject({
      component: "Users/Index",
      props: {
        errors: { form: "自分自身のアカウントは削除できません。" },
      },
    });
    expect(selfConflictProps.props.errors.form).not.toContain(admin.userId);
    expect(selfConflictProps.props.errors.form).not.toContain(
      adminCredentials.email,
    );

    const ignoredErrorPage = await requestPage(
      harness,
      "/users?error=tampered-code",
      adminCookie,
    );
    await expect(ignoredErrorPage.json()).resolves.toMatchObject({
      component: "Users/Index",
      props: { errors: {} },
    });

    const lastAdminApp = createApp({
      ...harness.dependencies,
      deleteUser: {
        run: () => errAsync({ kind: "CannotDeleteLastAdmin" } as const),
      },
    });
    const lastAdminResponse = await postForm(
      { app: lastAdminApp },
      "/users/76000000-0000-4000-8000-000000000099/delete",
      {},
      adminCookie,
    );
    expect(lastAdminResponse.status).toBe(303);
    expect(lastAdminResponse.headers.get("location")).toBe(
      "/users?error=cannot-delete-last-admin",
    );
    const lastAdminPageResponse = await lastAdminApp.request(
      "/users?error=cannot-delete-last-admin",
      { headers: { ...inertiaHeaders, Cookie: adminCookie } },
    );
    const lastAdminPage = await lastAdminPageResponse.json();
    expect(lastAdminPage).toMatchObject({
      component: "Users/Index",
      props: {
        errors: { form: "最後の管理者アカウントは削除できません。" },
      },
    });
    expect(lastAdminPage.props.errors.form).not.toContain(
      "76000000-0000-4000-8000-000000000099",
    );
  });

  test("Receptionist manages owner and pet PII through explicit page DTOs and guarded physical deletion", async () => {
    const harness = createHarness();
    const adminCookie = await setUp(harness);
    await createUser(
      harness,
      adminCookie,
      { ...receptionistCredentials, role: "Receptionist" },
    );
    const receptionistCookie = await logIn(harness, receptionistCredentials);

    const userPage = await requestPage(harness, "/users", receptionistCookie);
    expect(userPage.status).toBe(403);

    const ownerCreate = await postForm(
      harness,
      "/owners",
      {
        name: "Hanako Owner",
        email: "hanako.owner@example.test",
        phone: "090-1234-5678",
      },
      receptionistCookie,
    );
    expect(ownerCreate.status).toBe(302);
    expect(ownerCreate.headers.get("location")).toBe("/owners");
    const owner = harness.database.select().from(ownersTable).get();
    expect(owner).toBeDefined();
    if (owner === undefined) return;

    const ownerIndexResponse = await requestPage(
      harness,
      "/owners",
      receptionistCookie,
    );
    const ownerIndex = await ownerIndexResponse.json();
    expect(ownerIndex).toMatchObject({
      component: "Owners/Index",
      props: {
        owners: [
          {
            ownerId: owner.ownerId,
            name: "Hanako Owner",
            email: "hanako.owner@example.test",
            phone: "090-1234-5678",
          },
        ],
      },
    });
    expect(JSON.stringify(ownerIndex)).not.toContain("unwrap");

    const ownerDetailResponse = await requestPage(
      harness,
      `/owners/${owner.ownerId}`,
      receptionistCookie,
    );
    expect(await ownerDetailResponse.json()).toMatchObject({
      component: "Owners/Form",
      props: {
        mode: "edit",
        owner: {
          ownerId: owner.ownerId,
          name: "Hanako Owner",
          email: "hanako.owner@example.test",
          phone: "090-1234-5678",
        },
      },
    });

    const ownerUpdate = await postForm(
      harness,
      `/owners/${owner.ownerId}`,
      {
        name: "Hanako Updated",
        email: "hanako.updated@example.test",
        phone: "03-1234-5678",
      },
      receptionistCookie,
    );
    expect(ownerUpdate.status).toBe(302);

    const petCreate = await postForm(
      harness,
      "/pets",
      { ownerId: owner.ownerId, name: "Mugi", species: "Cat" },
      receptionistCookie,
    );
    expect(petCreate.status).toBe(302);
    expect(petCreate.headers.get("location")).toBe("/pets");
    const pet = harness.database.select().from(petsTable).get();
    expect(pet).toBeDefined();
    if (pet === undefined) return;

    const petIndexResponse = await requestPage(
      harness,
      "/pets",
      receptionistCookie,
    );
    expect(await petIndexResponse.json()).toMatchObject({
      component: "Pets/Index",
      props: {
        pets: [
          {
            petId: pet.petId,
            ownerId: owner.ownerId,
            name: "Mugi",
            species: "Cat",
          },
        ],
      },
    });

    const petDetailResponse = await requestPage(
      harness,
      `/pets/${pet.petId}`,
      receptionistCookie,
    );
    expect(await petDetailResponse.json()).toMatchObject({
      component: "Pets/Form",
      props: {
        mode: "edit",
        pet: {
          petId: pet.petId,
          ownerId: owner.ownerId,
          name: "Mugi",
          species: "Cat",
        },
      },
    });

    const petUpdate = await postForm(
      harness,
      `/pets/${pet.petId}`,
      { name: "Mugi Updated", species: "Feline" },
      receptionistCookie,
    );
    expect(petUpdate.status).toBe(302);

    const ownerBlocked = await postForm(
      harness,
      `/owners/${owner.ownerId}/delete`,
      {},
      receptionistCookie,
    );
    expect(ownerBlocked.status).toBe(303);
    expect(ownerBlocked.headers.get("location")).toBe(
      `/owners/${owner.ownerId}?error=owner-has-pets`,
    );
    const ownerConflictResponse = await requestPage(
      harness,
      `/owners/${owner.ownerId}?error=owner-has-pets`,
      receptionistCookie,
    );
    const ownerConflictPage = await ownerConflictResponse.json();
    expect(ownerConflictPage).toMatchObject({
      component: "Owners/Form",
      props: {
        errors: {
          form: "ペットが登録されている飼い主は削除できません。先にペットを確認してください。",
        },
      },
    });
    expect(ownerConflictPage.props.errors.form).not.toContain(owner.ownerId);
    expect(ownerConflictPage.props.errors.form).not.toContain(owner.email);

    const appointmentId = "75000000-0000-4000-8000-000000000001";
    const appointment = {
      kind: "Scheduled",
      appointmentId,
      ownerId: owner.ownerId,
      petId: pet.petId,
      scheduledAt: "2026-08-10T01:30:00.000Z",
      reason: "Annual checkup",
    } as const;
    harness.database.insert(appointmentsTable).values({
      appointmentId,
      status: "Scheduled",
      ownerId: owner.ownerId,
      petId: pet.petId,
      state: appointment,
    }).run();

    const petBlocked = await postForm(
      harness,
      `/pets/${pet.petId}/delete`,
      {},
      receptionistCookie,
    );
    expect(petBlocked.status).toBe(303);
    expect(petBlocked.headers.get("location")).toBe(
      `/pets/${pet.petId}?error=pet-has-active-appointment`,
    );
    const petConflictResponse = await requestPage(
      harness,
      `/pets/${pet.petId}?error=pet-has-active-appointment`,
      receptionistCookie,
    );
    const petConflictPage = await petConflictResponse.json();
    expect(petConflictPage).toMatchObject({
      component: "Pets/Form",
      props: {
        errors: {
          form: "進行中の予約があるペットは削除できません。先に予約を確認してください。",
        },
      },
    });
    expect(petConflictPage.props.errors.form).not.toContain(pet.petId);
    expect(petConflictPage.props.errors.form).not.toContain(pet.name);
    harness.database
      .delete(appointmentsTable)
      .where(eq(appointmentsTable.appointmentId, appointmentId))
      .run();

    const petDelete = await postForm(
      harness,
      `/pets/${pet.petId}/delete`,
      {},
      receptionistCookie,
    );
    expect(petDelete.status).toBe(302);
    expect(
      harness.database
        .select()
        .from(petsTable)
        .where(eq(petsTable.petId, pet.petId))
        .get(),
    ).toBeUndefined();

    const ownerDelete = await postForm(
      harness,
      `/owners/${owner.ownerId}/delete`,
      {},
      receptionistCookie,
    );
    expect(ownerDelete.status).toBe(302);
    expect(
      harness.database
        .select()
        .from(ownersTable)
        .where(eq(ownersTable.ownerId, owner.ownerId))
        .get(),
    ).toBeUndefined();

    const retainedEvents = harness.database
      .select()
      .from(domainEventsTable)
      .all();
    expect(retainedEvents.map(({ eventName }) => eventName)).toEqual(
      expect.arrayContaining(["pet.deleted", "owner.deleted"]),
    );
    expect(JSON.stringify(retainedEvents)).not.toContain("Hanako Updated");
    expect(JSON.stringify(retainedEvents)).not.toContain(
      "hanako.updated@example.test",
    );
  });

  test("rejects malformed owner and pet inputs before use cases", async () => {
    const harness = createHarness();
    const adminCookie = await setUp(harness);

    const invalidOwnerResponse = await postForm(
      harness,
      "/owners",
      { name: "", email: "invalid", phone: "" },
      adminCookie,
    );
    expect(invalidOwnerResponse.status).toBe(200);
    expect(await invalidOwnerResponse.json()).toMatchObject({
      component: "Owners/Form",
      props: {
        errors: {
          name: expect.any(String),
          email: expect.any(String),
          phone: expect.any(String),
        },
      },
    });

    const invalidPetResponse = await postForm(
      harness,
      "/pets",
      { ownerId: "not-an-owner-id", name: "", species: "" },
      adminCookie,
    );
    expect(invalidPetResponse.status).toBe(200);
    expect(await invalidPetResponse.json()).toMatchObject({
      component: "Pets/Form",
      props: {
        errors: {
          ownerId: expect.any(String),
          name: expect.any(String),
          species: expect.any(String),
        },
      },
    });
  });

  test("turns an owner deletion race conflict into a safe detail-page error", async () => {
    const harness = createHarness();
    const adminCookie = await setUp(harness);
    const ownerCreate = await postForm(
      harness,
      "/owners",
      {
        name: "Race Owner",
        email: "race.owner@example.test",
        phone: "090-9876-5432",
      },
      adminCookie,
    );
    expect(ownerCreate.status).toBe(302);
    const owner = harness.database.select().from(ownersTable).get();
    expect(owner).toBeDefined();
    if (owner === undefined) return;

    const conflictApp = createApp({
      ...harness.dependencies,
      deleteOwner: {
        run: () =>
          errAsync({
            kind: "OwnerDeletionConflict",
            ownerId: OwnerId.schema.parse(owner.ownerId),
          } as const),
      },
    });
    const response = await postForm(
      { app: conflictApp },
      `/owners/${owner.ownerId}/delete`,
      {},
      adminCookie,
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      `/owners/${owner.ownerId}?error=owner-deletion-conflict`,
    );
    const pageResponse = await conflictApp.request(
      `/owners/${owner.ownerId}?error=owner-deletion-conflict`,
      { headers: { ...inertiaHeaders, Cookie: adminCookie } },
    );
    const page = await pageResponse.json();
    expect(page).toMatchObject({
      component: "Owners/Form",
      props: {
        errors: {
          form: "飼い主を削除できませんでした。最新の状態を確認してください。",
        },
      },
    });
    expect(page.props.errors.form).not.toContain(owner.ownerId);
    expect(page.props.errors.form).not.toContain(owner.email);
  });

  test("turns a pet deletion race conflict into a safe detail-page error", async () => {
    const harness = createHarness();
    const adminCookie = await setUp(harness);
    await postForm(
      harness,
      "/owners",
      {
        name: "Race Pet Owner",
        email: "race.pet.owner@example.test",
        phone: "090-1111-2222",
      },
      adminCookie,
    );
    const owner = harness.database.select().from(ownersTable).get();
    expect(owner).toBeDefined();
    if (owner === undefined) return;
    await postForm(
      harness,
      "/pets",
      { ownerId: owner.ownerId, name: "Race Pet", species: "Dog" },
      adminCookie,
    );
    const pet = harness.database.select().from(petsTable).get();
    expect(pet).toBeDefined();
    if (pet === undefined) return;

    const conflictApp = createApp({
      ...harness.dependencies,
      deletePet: {
        run: () =>
          errAsync({
            kind: "PetDeletionConflict",
            petId: PetId.schema.parse(pet.petId),
          } as const),
      },
    });
    const response = await postForm(
      { app: conflictApp },
      `/pets/${pet.petId}/delete`,
      {},
      adminCookie,
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      `/pets/${pet.petId}?error=pet-deletion-conflict`,
    );
    const pageResponse = await conflictApp.request(
      `/pets/${pet.petId}?error=pet-deletion-conflict`,
      { headers: { ...inertiaHeaders, Cookie: adminCookie } },
    );
    const page = await pageResponse.json();
    expect(page).toMatchObject({
      component: "Pets/Form",
      props: {
        errors: {
          form: "ペットを削除できませんでした。最新の状態を確認してください。",
        },
      },
    });
    expect(page.props.errors.form).not.toContain(pet.petId);
    expect(page.props.errors.form).not.toContain(pet.name);
  });

  test("Veterinarian cannot discover management routes", async () => {
    const harness = createHarness();
    const adminCookie = await setUp(harness);
    await createUser(
      harness,
      adminCookie,
      { ...veterinarianCredentials, role: "Veterinarian" },
    );
    const veterinarianCookie = await logIn(
      harness,
      veterinarianCredentials,
    );

    const responses = await Promise.all([
      requestPage(harness, "/users", veterinarianCookie),
      requestPage(harness, "/users/new", veterinarianCookie),
      requestPage(harness, "/owners", veterinarianCookie),
      requestPage(harness, "/owners/new", veterinarianCookie),
      requestPage(harness, "/pets", veterinarianCookie),
      requestPage(harness, "/pets/new", veterinarianCookie),
    ]);

    expect(responses.map(({ status }) => status)).toEqual([
      403, 403, 403, 403, 403, 403,
    ]);
    await Promise.all(
      responses.map(async (response) => {
        const body = await response.text();
        expect(body).toBe("Forbidden");
        expect(body).not.toContain(veterinarianCredentials.email);
      }),
    );
  });
});
