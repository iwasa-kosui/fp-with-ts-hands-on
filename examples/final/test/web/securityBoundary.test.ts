import { eq } from "drizzle-orm";
import { createElement, type ComponentType } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { createSqliteDatabase, migrateDatabase } from "../../src/adaptor/secondary/sqlite/db.js";
import {
  appointmentsTable,
  ownersTable,
  petsTable,
  sessionsTable,
  usersTable,
} from "../../src/adaptor/secondary/sqlite/schema.js";
import AppointmentsIndex from "../../src/adaptor/primary/web/pages/Appointments/Index.js";
import AppointmentNew from "../../src/adaptor/primary/web/pages/Appointments/New.js";
import AppointmentShow from "../../src/adaptor/primary/web/pages/Appointments/Show.js";
import type { AppointmentPageView } from "../../src/adaptor/primary/web/routes/appointmentRoutes.js";
import Dashboard from "../../src/adaptor/primary/web/pages/Dashboard.js";
import EventsIndex from "../../src/adaptor/primary/web/pages/Events/Index.js";
import FollowUpsIndex from "../../src/adaptor/primary/web/pages/FollowUps/Index.js";
import { Timestamp } from "../../src/domain/aggregate/timestamp.js";
import { AppointmentId } from "../../src/domain/appointment/appointmentId.js";
import { VeterinarianId } from "../../src/domain/appointment/veterinarianId.js";
import { PaymentAmount } from "../../src/domain/appointment/paymentAmount.js";
import { ExamId } from "../../src/domain/examResult/examId.js";
import { EventId } from "../../src/domain/aggregate/eventId.js";
import { OwnerId } from "../../src/domain/owner/ownerId.js";
import { PetId } from "../../src/domain/pet/petId.js";
import { UserId } from "../../src/domain/user/userId.js";
import {
  createApp,
  createApplicationDependencies,
} from "../../src/app.js";

const adminId = UserId.schema.parse("76000000-0000-4000-8000-000000000001");
const vetId = UserId.schema.parse("76000000-0000-4000-8000-000000000002");
const ownerId = OwnerId.schema.parse("73000000-0000-4000-8000-000000000001");
const petId = PetId.schema.parse("74000000-0000-4000-8000-000000000001");
const appointmentId = AppointmentId.schema.parse("75000000-0000-4000-8000-000000000001");
const veterinarianId = VeterinarianId.schema.parse("77000000-0000-4000-8000-000000000001");
const scheduledAt = Timestamp.schema.parse("2026-08-10T03:00:00.000Z");

const renderPage = async <TProps extends object>(
  component: ComponentType<TProps>,
  props: TProps,
): Promise<string> => renderToString(createElement(component, props));
const shared = (role: "Admin" | "Receptionist" | "Veterinarian") => ({
  auth: { user: { userId: role === "Veterinarian" ? vetId : adminId, role } },
  flash: {},
  errors: {},
});
const scheduledView = {
  appointmentId,
  kind: "Scheduled" as const,
  ownerId,
  ownerName: "Hanako Owner",
  petId,
  petName: "Mugi",
  scheduledAt,
};
const checkedInAt = Timestamp.schema.parse("2026-08-10T03:10:00.000Z");
const examinationStartedAt = Timestamp.schema.parse("2026-08-10T03:20:00.000Z");
const paidAt = Timestamp.schema.parse("2026-08-10T04:00:00.000Z");
const canceledAt = Timestamp.schema.parse("2026-08-09T03:00:00.000Z");
const paymentAmount = PaymentAmount.schema.parse(12_500);

const incompletePaidView = {
  ...scheduledView,
  kind: "Paid" as const,
  amount: paymentAmount,
};
// @ts-expect-error Paid requires the full safe chronology and veterinarian projection.
const invalidPaidView: AppointmentPageView = incompletePaidView;

const scheduledWithPaidState = {
  ...scheduledView,
  // @ts-expect-error Scheduled cannot carry Paid-only state fields.
  paidAt,
} as const satisfies AppointmentPageView;

describe("clinic page SSR", () => {
  test("renders exact role-aware navigation", async () => {
    const dashboardProps = {
      counts: { owners: 0, pets: 0, appointments: 0, activeAppointments: 0 },
      activeAppointments: [],
    };
    const adminHtml = await renderPage(Dashboard, {
      ...shared("Admin"),
      ...dashboardProps,
    });
    expect(adminHtml).toContain('href="/appointments"');
    expect(adminHtml).toContain('href="/follow-ups"');
    expect(adminHtml).toContain('href="/events"');
    expect(adminHtml).toContain('href="/users"');

    const receptionistHtml = await renderPage(Dashboard, {
      ...shared("Receptionist"),
      ...dashboardProps,
    });
    expect(receptionistHtml).toContain('href="/appointments"');
    expect(receptionistHtml).toContain('href="/follow-ups"');
    expect(receptionistHtml).not.toContain('href="/events"');
    expect(receptionistHtml).not.toContain('href="/users"');

    const vetHtml = await renderPage(Dashboard, {
      ...shared("Veterinarian"),
      ...dashboardProps,
    });
    expect(vetHtml).toContain('href="/appointments"');
    expect(vetHtml).not.toContain('href="/follow-ups"');
    expect(vetHtml).not.toContain('href="/events"');
    expect(vetHtml).not.toContain('href="/owners"');
  });

  test("renders accessible booking and state-specific appointment forms", async () => {
    const booking = await renderPage(AppointmentNew, {
      ...shared("Receptionist"),
      owners: [{ ownerId, name: "Hanako Owner" }],
      pets: [{ petId, ownerId, name: "Mugi" }],
      errors: {
        ownerId: "飼い主を確認してください。",
        petId: "ペットを確認してください。",
        scheduledAt: "日時を確認してください。",
        reason: "理由を確認してください。",
      },
    });
    expect(booking).toContain('aria-label="入力エラー"');
    for (const field of ["ownerId", "petId", "scheduledAt", "reason"]) {
      expect(booking).toContain(`aria-describedby="${field}-error"`);
      expect(booking).toContain('aria-invalid="true"');
    }

    const scheduled = await renderPage(AppointmentShow, {
      ...shared("Receptionist"),
      appointment: scheduledView,
      actions: {
        checkIn: true,
        cancel: true,
        startExamination: false,
        recordExamResult: false,
        recordPayment: false,
      },
      veterinarianId: null,
    });
    expect(scheduled).toContain("受付する");
    expect(scheduled).toContain("予約をキャンセル");
    expect(scheduled).not.toContain("診察を開始");
    expect(scheduled).not.toContain("診察結果を記録");
    expect(scheduled).not.toContain("会計を記録");

    const examinationStartedAt = Timestamp.schema.parse("2026-08-09T02:00:00.000Z");
    const examining = await renderPage(AppointmentShow, {
      ...shared("Veterinarian"),
      appointment: {
        ...scheduledView,
        kind: "InExamination",
        checkedInAt: Timestamp.schema.parse("2026-08-09T01:30:00.000Z"),
        veterinarianId,
        veterinarianName: "Clinic Vet",
        examinationStartedAt,
      },
      actions: {
        checkIn: false,
        cancel: false,
        startExamination: false,
        recordExamResult: true,
        recordPayment: false,
      },
      veterinarianId,
      errors: { item: "診察結果を確認してください。" },
    });
    expect(examining).toContain("診察結果を記録");
    expect(examining).toContain('aria-describedby="item-error"');
    expect(examining).not.toContain("会計を記録");
  });

  test("renders exact safe detail fields for every appointment state", async () => {
    const noActions = {
      checkIn: false,
      cancel: false,
      startExamination: false,
      recordExamResult: false,
      recordPayment: false,
    } as const;
    const checkedInView = {
      ...scheduledView,
      kind: "CheckedIn" as const,
      checkedInAt,
    } satisfies AppointmentPageView;
    const examiningView = {
      ...scheduledView,
      kind: "InExamination" as const,
      checkedInAt,
      veterinarianId,
      veterinarianName: "Clinic Vet",
      examinationStartedAt,
    } satisfies AppointmentPageView;
    const awaitingPaymentView = {
      ...examiningView,
      kind: "AwaitingPayment" as const,
      examId: ExamId.schema.parse("71000000-0000-4000-8000-000000000030"),
      examinationCompletedAt: Timestamp.schema.parse("2026-08-09T02:30:00.000Z"),
    } satisfies AppointmentPageView;
    const paidView = {
      ...awaitingPaymentView,
      kind: "Paid" as const,
      amount: paymentAmount,
      paidAt,
    } satisfies AppointmentPageView;
    const canceledView = {
      ...scheduledView,
      kind: "Canceled" as const,
      canceledAt,
    } satisfies AppointmentPageView;

    const scheduled = await renderPage(AppointmentShow, {
      ...shared("Admin"), appointment: scheduledView, actions: noActions, veterinarianId: null,
    });
    const checkedIn = await renderPage(AppointmentShow, {
      ...shared("Admin"), appointment: checkedInView, actions: noActions, veterinarianId: null,
    });
    const examining = await renderPage(AppointmentShow, {
      ...shared("Admin"), appointment: examiningView, actions: noActions, veterinarianId: null,
    });
    const awaitingPayment = await renderPage(AppointmentShow, {
      ...shared("Admin"),
      appointment: awaitingPaymentView,
      actions: { ...noActions, recordPayment: true },
      veterinarianId: null,
    });
    const paid = await renderPage(AppointmentShow, {
      ...shared("Admin"), appointment: paidView, actions: noActions, veterinarianId: null,
    });
    const canceled = await renderPage(AppointmentShow, {
      ...shared("Admin"), appointment: canceledView, actions: noActions, veterinarianId: null,
    });

    expect(scheduled).not.toContain("担当獣医師");
    expect(checkedIn).toContain(checkedInAt);
    expect(checkedIn).not.toContain("診察開始日時");
    expect(examining).toContain(examinationStartedAt);
    expect(examining).toContain("Clinic Vet");
    expect(awaitingPayment).toContain("診察結果記録済み・会計待ち");
    expect(awaitingPayment).toContain("会計を記録");
    expect(awaitingPayment).not.toContain("診察結果を記録");
    expect(paid).toContain(`${paymentAmount}`);
    expect(paid).toContain("支払額");
    expect(paid).toContain(paidAt);
    expect(canceled).toContain(canceledAt);
    expect(canceled).not.toContain("受付日時");
  });

  test("renders lists and redacted event fields structurally without rebuilding hidden values", async () => {
    const appointments = await renderPage(AppointmentsIndex, {
      ...shared("Admin"),
      appointments: [scheduledView],
    });
    expect(appointments).toContain("Scheduled");
    expect(appointments).toContain("Hanako Owner");

    const followUps = await renderPage(FollowUpsIndex, {
      ...shared("Receptionist"),
      followUps: [{ appointmentId, petId, ownerName: "Hanako Owner", ownerPhone: "090-1234-5678", requested: false }],
    });
    expect(followUps).toContain("090-1234-5678");
    expect(followUps).toContain("フォローアップを依頼");

    const events = await renderPage(EventsIndex, {
      ...shared("Admin"),
      events: [{
        eventId: EventId.schema.parse("78000000-0000-4000-8000-000000000001"),
        aggregateId: appointmentId,
        aggregateName: "Appointment",
        eventName: "appointment.payment-recorded",
        occurredAt: Timestamp.schema.parse("2026-08-09T03:00:00.000Z"),
        actorUserId: adminId,
        aggregateState: { kind: "Paid", diagnosis: "[REDACTED]" },
        eventPayload: { appointmentId, secret: "[REDACTED]" },
      }],
    });
    expect(events).toContain("[REDACTED]");
    expect(events).toContain("<dt>diagnosis</dt><dd>[REDACTED]</dd>");
    expect(events).toContain("<dt>secret</dt><dd>[REDACTED]</dd>");
    expect(events).toContain("appointment.payment-recorded");
    expect(events).not.toContain("<pre");
  });
});

const inertiaHeaders = {
  Accept: "application/json",
  "X-Inertia": "true",
  "X-Inertia-Version": "1",
} as const;
const post = (
  app: ReturnType<typeof createApp>,
  path: string,
  values: Readonly<Record<string, string>>,
  cookie?: string,
) => app.request(path, {
  method: "POST",
  body: new URLSearchParams(values),
  headers: {
    ...inertiaHeaders,
    "Content-Type": "application/x-www-form-urlencoded",
    Origin: "http://localhost",
    ...(cookie === undefined ? {} : { Cookie: cookie }),
  },
});
const cookiePair = (response: Response): string =>
  response.headers.get("set-cookie")?.split(";")[0] ?? "";

describe("Inertia security boundary", () => {
  test("keeps contact data, credentials, tokens, and clinical free text inside authorized pages only", async () => {
    const database = createSqliteDatabase(":memory:");
    migrateDatabase(database);
    const clock = { now: () => Timestamp.schema.parse("2026-08-09T03:00:00.000Z") } as const;
    const app = createApp(createApplicationDependencies(database, { clock, isProduction: false }));
    const adminResponse = await post(app, "/setup", {
      email: "admin@example.test",
      name: "Clinic Admin",
      password: "correct horse battery staple",
    });
    const adminCookie = cookiePair(adminResponse);
    await post(app, "/users", {
      email: "vet@example.test",
      name: "Clinic Vet",
      password: "veterinarian password value",
      role: "Veterinarian",
    }, adminCookie);
    const vetCookie = cookiePair(await post(app, "/login", {
      email: "vet@example.test",
      password: "veterinarian password value",
    }));
    await post(app, "/owners", {
      name: "Hanako Owner",
      email: "hanako.owner@example.test",
      phone: "090-1234-5678",
    }, adminCookie);
    const owner = database.select().from(ownersTable).get();
    if (owner === undefined) throw new TypeError("owner missing");
    await post(app, "/pets", { ownerId: owner.ownerId, name: "Mugi", species: "Cat" }, adminCookie);
    const pet = database.select().from(petsTable).get();
    if (pet === undefined) throw new TypeError("pet missing");
    await post(app, "/appointments", {
      ownerId: owner.ownerId,
      petId: pet.petId,
      scheduledAt: "2026-08-10T03:00:00.000Z",
      reason: "Private visit reason",
    }, adminCookie);
    const appointment = database.select().from(appointmentsTable).get();
    if (appointment === undefined) throw new TypeError("appointment missing");
    await post(app, `/appointments/${appointment.appointmentId}/check-in`, {}, adminCookie);
    await post(app, `/appointments/${appointment.appointmentId}/start-examination`, {}, vetCookie);
    const privateFinding = "Highly sensitive clinical finding";
    await post(app, `/appointments/${appointment.appointmentId}/exam-results`, {
      petId: pet.petId,
      collectedAt: "2026-08-09T03:00:00.000Z",
      item: privateFinding,
      needsFollowUp: "true",
    }, vetCookie);
    await post(app, `/appointments/${appointment.appointmentId}/payment`, {
      diagnosis: "Private diagnosis",
      treatment: "Private treatment",
      amount: "12500",
    }, adminCookie);

    const adminRow = database.select().from(usersTable).where(eq(usersTable.email, "admin@example.test")).get();
    const sessionRow = database.select().from(sessionsTable).get();
    if (adminRow === undefined || sessionRow === undefined) throw new TypeError("security fixture missing");
    const forbiddenValues = [
      "hanako.owner@example.test",
      "090-1234-5678",
      adminRow.passwordHash,
      sessionRow.tokenHash,
      privateFinding,
      "Private visit reason",
      "Private diagnosis",
      "Private treatment",
    ];
    for (const path of ["/", "/appointments", `/appointments/${appointment.appointmentId}`, "/events"]) {
      const response = await app.request(path, { headers: { ...inertiaHeaders, Cookie: adminCookie } });
      const page = await response.json();
      const body = JSON.stringify(page);
      for (const value of forbiddenValues) expect(body).not.toContain(value);
      if (path === "/appointments" || path.startsWith("/appointments/")) {
        expect(body).not.toContain('"state"');
        expect(body).not.toContain('"reason"');
      }
    }
    const dashboard = await app.request("/", {
      headers: { ...inertiaHeaders, Cookie: adminCookie },
    });
    const dashboardBody = await dashboard.text();
    expect(dashboardBody).not.toContain("Hanako Owner");
    expect(dashboardBody).not.toContain("Private visit reason");

    const ownerPage = await app.request(`/owners/${owner.ownerId}`, { headers: { ...inertiaHeaders, Cookie: adminCookie } });
    const ownerBody = await ownerPage.text();
    expect(ownerBody).toContain("hanako.owner@example.test");
    expect(ownerBody).toContain("090-1234-5678");

    const followUpPage = await app.request("/follow-ups", { headers: { ...inertiaHeaders, Cookie: adminCookie } });
    const followUpBody = await followUpPage.text();
    expect(followUpBody).toContain("090-1234-5678");
    expect(followUpBody).not.toContain("hanako.owner@example.test");
    expect(followUpBody).not.toContain(privateFinding);

    const eventsPage = await app.request("/events", { headers: { ...inertiaHeaders, Cookie: adminCookie } });
    const events = await eventsPage.json();
    expect(events).toMatchObject({
      component: "Events/Index",
      props: {
        events: expect.arrayContaining([
          expect.objectContaining({ eventName: "appointment.payment-recorded", eventId: expect.any(String) }),
          expect.objectContaining({ eventName: "exam-result.recorded", eventId: expect.any(String) }),
        ]),
      },
    });
    const eventBody = JSON.stringify(events);
    for (const value of [
      "hanako.owner@example.test",
      "090-1234-5678",
      adminRow.passwordHash,
      sessionRow.tokenHash,
      privateFinding,
      "Private diagnosis",
      "Private treatment",
      "Private visit reason",
      "Hanako Owner",
    ]) expect(eventBody).not.toContain(value);

    const vetEvents = await app.request("/events", { headers: { ...inertiaHeaders, Cookie: vetCookie } });
    expect(vetEvents.status).toBe(403);

    const invalid = await post(app, `/appointments/${appointment.appointmentId}/payment`, {
      diagnosis: "do not echo diagnosis",
      treatment: "do not echo treatment",
      amount: "0",
    }, adminCookie);
    const invalidBody = await invalid.text();
    expect(invalidBody).not.toContain("do not echo diagnosis");
    expect(invalidBody).not.toContain("do not echo treatment");
  });
});
