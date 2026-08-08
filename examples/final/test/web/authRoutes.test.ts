import { eq } from "drizzle-orm";
import { errAsync } from "neverthrow";
import { describe, expect, test } from "vitest";

import { createSqliteDatabase, migrateDatabase } from "../../src/adaptor/secondary/sqlite/db.js";
import {
  installationTable,
  sessionsTable,
  usersTable,
} from "../../src/adaptor/secondary/sqlite/schema.js";
import { Timestamp } from "../../src/domain/aggregate/timestamp.js";
import {
  createApp,
  createApplicationDependencies,
} from "../../src/app.js";

const now = Timestamp.schema.parse("2026-08-09T01:30:00.000Z");
const clock = { now: () => now } as const;
const credentials = {
  email: "admin@example.test",
  name: "Clinic Admin",
  password: "correct horse battery staple",
} as const;

const createHarness = (isProduction = false) => {
  const database = createSqliteDatabase(":memory:");
  migrateDatabase(database);
  const app = createApp(
    createApplicationDependencies(database, { clock, isProduction }),
  );
  return { app, database } as const;
};

const inertiaHeaders = {
  Accept: "application/json",
  "X-Inertia": "true",
  "X-Inertia-Version": "1",
} as const;

const formRequest = (
  app: ReturnType<typeof createHarness>["app"],
  path: string,
  values: Readonly<Record<string, string>>,
  cookie?: string,
  origin = "http://localhost",
) =>
  app.request(path, {
    method: "POST",
    body: new URLSearchParams(values),
    headers: {
      ...inertiaHeaders,
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: origin,
      ...(cookie === undefined ? {} : { Cookie: cookie }),
    },
  });

const cookiePair = (response: Response): string => {
  const setCookie = response.headers.get("set-cookie");
  expect(setCookie).not.toBeNull();
  return setCookie?.split(";")[0] ?? "";
};

const setUp = async (harness: ReturnType<typeof createHarness>) => {
  const response = await formRequest(
    harness.app,
    "/setup",
    credentials,
  );
  expect(response.status).toBe(302);
  expect(response.headers.get("location")).toBe("/");
  return cookiePair(response);
};

describe("Hono/Inertia authentication boundary", () => {
  test("uses the installation marker instead of stale user projections for routing policy", async () => {
    const unclaimed = createHarness();
    unclaimed.database.insert(usersTable).values({
      userId: "76000000-0000-4000-8000-000000000001",
      role: "Admin",
      email: "stale@example.test",
      name: "Stale Admin",
      passwordHash: `scrypt$${"A".repeat(22)}==$${"B".repeat(86)}==`,
      veterinarianId: null,
    }).run();

    const unclaimedDashboard = await unclaimed.app.request("/", {
      headers: inertiaHeaders,
    });

    expect(unclaimedDashboard.status).toBe(302);
    expect(unclaimedDashboard.headers.get("location")).toBe("/setup");

    const claimed = createHarness();
    claimed.database
      .insert(installationTable)
      .values({ installationKey: "clinic" })
      .run();

    const claimedLogin = await claimed.app.request("/login", {
      headers: inertiaHeaders,
    });
    const claimedSetup = await claimed.app.request("/setup", {
      headers: inertiaHeaders,
    });

    expect(claimedLogin.status).toBe(200);
    expect(claimedSetup.status).toBe(302);
    expect(claimedSetup.headers.get("location")).toBe("/login");
  });

  test("maps installation-status query failures safely and exposes no user-list policy dependency", async () => {
    const database = createSqliteDatabase(":memory:");
    migrateDatabase(database);
    const composed = createApplicationDependencies(database, {
      clock,
      isProduction: false,
    });
    const app = createApp({
      ...composed,
      installationStatusQuery: {
        get: () =>
          errAsync({
            kind: "RepositoryError",
            operation: "InstallationStatusQuery.get",
            cause: new Error("private database cause"),
          }),
      },
    });

    const response = await app.request("/", { headers: inertiaHeaders });
    const serializedDependencies = JSON.stringify(Object.keys(composed));

    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("private database cause");
    expect(serializedDependencies).not.toContain("userListResolver");
  });

  test("directs an empty installation to setup and makes setup unavailable after the first Admin", async () => {
    const harness = createHarness();

    const dashboardBeforeSetup = await harness.app.request("/", {
      headers: inertiaHeaders,
    });
    expect(dashboardBeforeSetup.status).toBe(302);
    expect(dashboardBeforeSetup.headers.get("location")).toBe("/setup");

    const setupPage = await harness.app.request("/setup", {
      headers: inertiaHeaders,
    });
    expect(setupPage.status).toBe(200);
    await expect(setupPage.json()).resolves.toMatchObject({
      component: "Setup",
      props: { auth: { user: null }, errors: {} },
    });

    const logoutBeforeSetup = await formRequest(harness.app, "/logout", {});
    expect(logoutBeforeSetup.status).toBe(302);
    expect(logoutBeforeSetup.headers.get("location")).toBe("/setup");

    await setUp(harness);

    const setupAfterCreation = await harness.app.request("/setup");
    expect(setupAfterCreation.status).toBe(302);
    expect(setupAfterCreation.headers.get("location")).toBe("/login");
  });

  test("renders the required Inertia shell without placing secrets in HTML", async () => {
    const { app } = createHarness();

    const response = await app.request("/setup");
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('data-page="app"');
    expect(html).toContain("/src/adaptor/primary/web/client.tsx");
    expect(html).not.toContain(credentials.password);
  });

  test("renders production assets from the validated composition setting", async () => {
    const { app } = createHarness(true);

    const response = await app.request("/setup");
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain("/static/client.js");
    expect(html).toContain("/static/styles.css");
    expect(html).not.toContain("/src/adaptor/primary/web/client.tsx");
  });

  test("rejects an unknown NODE_ENV at the composition boundary", () => {
    const database = createSqliteDatabase(":memory:");
    migrateDatabase(database);
    const previousNodeEnvironment = process.env.NODE_ENV;

    try {
      process.env.NODE_ENV = "staging";
      expect(() => createApplicationDependencies(database)).toThrow();
    } finally {
      if (previousNodeEnvironment === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = previousNodeEnvironment;
      }
    }
  });

  test("sets a host-scoped HttpOnly SameSite cookie whose plaintext is absent from SQLite", async () => {
    const harness = createHarness();

    const response = await formRequest(harness.app, "/setup", credentials);
    const setCookie = response.headers.get("set-cookie") ?? "";
    const cookie = cookiePair(response);
    const plaintextToken = cookie.split("=")[1] ?? "";
    const storedSession = harness.database.select().from(sessionsTable).get();

    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).toContain("Path=/");
    expect(setCookie).toContain("Max-Age=28800");
    expect(setCookie).not.toContain("Domain=");
    expect(setCookie).not.toContain("Secure");
    expect(plaintextToken).toHaveLength(64);
    expect(storedSession?.tokenHash).not.toBe(plaintextToken);
    expect(JSON.stringify(storedSession)).not.toContain(plaintextToken);
  });

  test("adds Secure to the session cookie in production", async () => {
    const harness = createHarness(true);

    const response = await formRequest(harness.app, "/setup", credentials);

    expect(response.headers.get("set-cookie")).toContain("Secure");
  });

  test("uses the same non-enumerating Inertia error for unknown email and wrong password", async () => {
    const harness = createHarness();
    await setUp(harness);

    const unknownEmail = await formRequest(harness.app, "/login", {
      email: "missing@example.test",
      password: "wrong password value",
    });
    const wrongPassword = await formRequest(harness.app, "/login", {
      email: credentials.email,
      password: "wrong password value",
    });
    const unknownPage = await unknownEmail.json();
    const wrongPage = await wrongPassword.json();

    expect(unknownEmail.status).toBe(200);
    expect(wrongPassword.status).toBe(200);
    expect(unknownPage).toMatchObject({
      component: "Login",
      props: { errors: { credentials: "メールアドレスまたはパスワードが正しくありません" } },
    });
    expect(wrongPage.props.errors).toEqual(unknownPage.props.errors);
    expect(JSON.stringify(unknownPage)).not.toContain("missing@example.test");
  });

  test("validates external form values before calling authentication use cases", async () => {
    const harness = createHarness();

    const setupResponse = await formRequest(harness.app, "/setup", {
      email: "not-an-email",
      name: "",
      password: "short",
    });
    const setupPage = await setupResponse.json();

    expect(setupResponse.status).toBe(200);
    expect(setupPage).toMatchObject({
      component: "Setup",
      props: {
        errors: {
          email: expect.any(String),
          name: expect.any(String),
          password: expect.any(String),
        },
      },
    });
  });

  test("logs in, protects the dashboard, and shares only a minimal actor view", async () => {
    const harness = createHarness();
    await setUp(harness);

    const unauthenticated = await harness.app.request("/", {
      headers: inertiaHeaders,
    });
    expect(unauthenticated.status).toBe(302);
    expect(unauthenticated.headers.get("location")).toBe("/login");

    const login = await formRequest(harness.app, "/login", {
      email: credentials.email,
      password: credentials.password,
    });
    expect(login.status).toBe(302);
    expect(login.headers.get("location")).toBe("/");
    const cookie = cookiePair(login);

    const dashboard = await harness.app.request("/", {
      headers: { ...inertiaHeaders, Cookie: cookie },
    });
    const page = await dashboard.json();
    const serializedPage = JSON.stringify(page);
    const storedSession = harness.database.select().from(sessionsTable).get();

    expect(page).toMatchObject({
      component: "Dashboard",
      props: {
        auth: { user: { role: "Admin" } },
        counts: {
          owners: 0,
          pets: 0,
          appointments: 0,
          activeAppointments: 0,
        },
      },
    });
    expect(Object.keys(page.props.auth.user).sort()).toEqual(["role", "userId"]);
    expect(serializedPage).not.toContain(credentials.email);
    expect(serializedPage).not.toContain(credentials.name);
    expect(serializedPage).not.toContain(credentials.password);
    expect(serializedPage).not.toContain(cookie.split("=")[1]);
    expect(serializedPage).not.toContain(storedSession?.tokenHash ?? "unreachable");
  });

  test("treats an expired session as unauthenticated and clears its cookie", async () => {
    const harness = createHarness();
    const cookie = await setUp(harness);
    const session = harness.database.select().from(sessionsTable).get();
    expect(session).toBeDefined();
    if (session === undefined) return;
    harness.database
      .update(sessionsTable)
      .set({ expiresAt: "2026-08-09T01:29:59.000Z" })
      .where(eq(sessionsTable.sessionId, session.sessionId))
      .run();

    const response = await harness.app.request("/", {
      headers: { ...inertiaHeaders, Cookie: cookie },
    });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/login");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  test("logout invalidates only the current session and clears its cookie", async () => {
    const harness = createHarness();
    await setUp(harness);
    const firstLogin = await formRequest(harness.app, "/login", {
      email: credentials.email,
      password: credentials.password,
    });
    const secondLogin = await formRequest(harness.app, "/login", {
      email: credentials.email,
      password: credentials.password,
    });
    const firstCookie = cookiePair(firstLogin);
    const secondCookie = cookiePair(secondLogin);

    const logout = await formRequest(
      harness.app,
      "/logout",
      {},
      firstCookie,
    );
    expect(logout.status).toBe(302);
    expect(logout.headers.get("location")).toBe("/login");
    expect(logout.headers.get("set-cookie")).toContain("Max-Age=0");

    const formerSession = await harness.app.request("/", {
      headers: { ...inertiaHeaders, Cookie: firstCookie },
    });
    const otherSession = await harness.app.request("/", {
      headers: { ...inertiaHeaders, Cookie: secondCookie },
    });
    expect(formerSession.status).toBe(302);
    expect(formerSession.headers.get("location")).toBe("/login");
    expect(otherSession.status).toBe(200);
  });

  test("rejects cross-origin form submissions before any state change", async () => {
    const harness = createHarness();

    const response = await formRequest(
      harness.app,
      "/setup",
      credentials,
      undefined,
      "https://attacker.example",
    );

    expect(response.status).toBe(403);
    expect(harness.database.select().from(sessionsTable).all()).toHaveLength(0);
  });
});
