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
import { AppointmentReason } from "../../src/domain/appointment/appointmentReason.js";
import { AppointmentVersion } from "../../src/domain/appointment/appointmentVersion.js";
import { CancellationReason } from "../../src/domain/appointment/cancellationReason.js";
import { Diagnosis } from "../../src/domain/appointment/diagnosis.js";
import { VeterinarianId } from "../../src/domain/appointment/veterinarianId.js";
import { PaymentAmount } from "../../src/domain/appointment/paymentAmount.js";
import { SettlementAdjustmentAmount } from "../../src/domain/appointment/settlementAdjustmentAmount.js";
import { Treatment } from "../../src/domain/appointment/treatment.js";
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
const visitReason = AppointmentReason.schema.parse("private visit reason");

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
  scheduledEndsAt: Timestamp.schema.parse("2026-08-10T03:30:00.000Z"),
  durationMinutes: 30 as const,
  serviceCode: "GeneralConsultation" as const,
  bookingKind: "Reserved" as const,
  assignedVeterinarianId: null,
  assignedVeterinarianName: "未定",
  visitReason: visitReason.unwrap(),
  receptionNote: null,
  settlement: { kind: "NoPayment" as const },
  version: AppointmentVersion.schema.parse(1),
};
const checkedInAt = Timestamp.schema.parse("2026-08-10T03:10:00.000Z");
const examinationStartedAt = Timestamp.schema.parse("2026-08-10T03:20:00.000Z");
const paidAt = Timestamp.schema.parse("2026-08-10T04:00:00.000Z");
const canceledAt = Timestamp.schema.parse("2026-08-09T03:00:00.000Z");
const paymentAmount = PaymentAmount.schema.parse(12_500);
const noSettlementAdjustment = SettlementAdjustmentAmount.schema.parse(0);

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
    expect(adminHtml).toContain('href="/reception"');
    expect(adminHtml).toContain('href="/follow-ups"');
    expect(adminHtml).toContain('href="/events"');
    expect(adminHtml).toContain('href="/users"');

    const receptionistHtml = await renderPage(Dashboard, {
      ...shared("Receptionist"),
      ...dashboardProps,
    });
    expect(receptionistHtml).toContain('href="/appointments"');
    expect(receptionistHtml).toContain('href="/reception"');
    expect(receptionistHtml).toContain('href="/follow-ups"');
    expect(receptionistHtml).not.toContain('href="/events"');
    expect(receptionistHtml).not.toContain('href="/users"');

    const vetHtml = await renderPage(Dashboard, {
      ...shared("Veterinarian"),
      ...dashboardProps,
    });
    expect(vetHtml).toContain('href="/appointments"');
    expect(vetHtml).toContain('href="/reception"');
    expect(vetHtml).not.toContain('href="/follow-ups"');
    expect(vetHtml).not.toContain('href="/events"');
    expect(vetHtml).not.toContain('href="/owners"');
  });

  test("renders only safe dashboard metrics and appointment list fields", async () => {
    const dashboardHtml = await renderPage(Dashboard, {
      ...shared("Admin"),
      counts: { owners: 1, pets: 2, appointments: 3, activeAppointments: 1 },
      activeAppointments: [{
        appointmentId,
        kind: "InExamination" as const,
        petName: "Mugi",
        scheduledAt,
      }],
    });
    const appointmentsHtml = await renderPage(AppointmentsIndex, {
      ...shared("Admin"),
      date: "2026-08-10",
      today: "2026-08-10",
      appointments: [scheduledView],
    });
    const veterinarianAppointmentsHtml = await renderPage(AppointmentsIndex, {
      ...shared("Veterinarian"),
      date: "2026-08-10",
      today: "2026-08-10",
      appointments: [scheduledView],
    });

    expect(dashboardHtml).toContain("<dt>飼い主</dt><dd>1</dd>");
    expect(dashboardHtml).toContain("<dt>ペット</dt><dd>2</dd>");
    expect(dashboardHtml).toContain('aria-label="進行中の予約"');
    expect(dashboardHtml).toContain("診察中");
    expect(dashboardHtml).not.toContain("InExamination");
    expect(dashboardHtml).not.toContain("Hanako Owner");
    expect(dashboardHtml).not.toContain("在庫管理");
    expect(dashboardHtml).not.toContain("システム通知");
    expect(dashboardHtml).not.toContain("検索");

    expect(appointmentsHtml).toContain('aria-label="予約カレンダー"');
    expect(appointmentsHtml).toContain('href="/appointments/new"');
    expect(appointmentsHtml).toContain("予約済み");
    expect(appointmentsHtml).not.toContain("Scheduled");
    expect(appointmentsHtml).not.toContain("Hanako Owner");
    expect(veterinarianAppointmentsHtml).not.toContain('href="/appointments/new"');
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
        edit: true,
        checkIn: true,
        reassignVeterinarian: true,
        updateReceptionNote: true,
        receiveDeposit: false,
        cancel: true,
        startExamination: false,
        recordExamResult: false,
        settle: false,
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
        assignedVeterinarianId: veterinarianId,
        checkedInAt: Timestamp.schema.parse("2026-08-09T01:30:00.000Z"),
        veterinarianId,
        veterinarianName: "Clinic Vet",
        examinationStartedAt,
      },
      actions: {
        edit: false,
        checkIn: false,
        reassignVeterinarian: false,
        updateReceptionNote: false,
        receiveDeposit: false,
        cancel: false,
        startExamination: false,
        recordExamResult: true,
        settle: false,
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
      edit: false,
      checkIn: false,
      reassignVeterinarian: false,
      updateReceptionNote: false,
      receiveDeposit: false,
      cancel: false,
      startExamination: false,
      recordExamResult: false,
      settle: false,
    } as const;
    const checkedInView = {
      ...scheduledView,
      kind: "CheckedIn" as const,
      checkedInAt,
      version: AppointmentVersion.schema.parse(2),
    } satisfies AppointmentPageView;
    const examiningView = {
      ...scheduledView,
      kind: "InExamination" as const,
      assignedVeterinarianId: veterinarianId,
      assignedVeterinarianName: "Clinic Vet",
      checkedInAt,
      veterinarianId,
      veterinarianName: "Clinic Vet",
      examinationStartedAt,
      version: AppointmentVersion.schema.parse(3),
    } satisfies AppointmentPageView;
    const awaitingPaymentView = {
      ...examiningView,
      kind: "AwaitingPayment" as const,
      examId: ExamId.schema.parse("71000000-0000-4000-8000-000000000030"),
      examinationCompletedAt: Timestamp.schema.parse("2026-08-09T02:30:00.000Z"),
      version: AppointmentVersion.schema.parse(4),
    } satisfies AppointmentPageView;
    const paidView = {
      ...awaitingPaymentView,
      kind: "Paid" as const,
      diagnosis: Diagnosis.schema.parse("private diagnosis").unwrap(),
      treatment: Treatment.schema.parse("private treatment").unwrap(),
      settlement: {
        kind: "Settled" as const,
        finalAmount: paymentAmount,
        depositAmount: noSettlementAdjustment,
        additionalPaymentAmount: SettlementAdjustmentAmount.schema.parse(paymentAmount),
        refundAmount: noSettlementAdjustment,
        settledAt: paidAt,
      },
      amount: paymentAmount,
      paidAt,
      version: AppointmentVersion.schema.parse(5),
    } satisfies AppointmentPageView;
    const canceledView = {
      ...scheduledView,
      kind: "Canceled" as const,
      cancellationReason: CancellationReason.schema.parse("private cancellation"),
      canceledAt,
      version: AppointmentVersion.schema.parse(2),
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
      actions: { ...noActions, settle: true },
      veterinarianId: null,
    });
    const paid = await renderPage(AppointmentShow, {
      ...shared("Admin"), appointment: paidView, actions: noActions, veterinarianId: null,
    });
    const canceled = await renderPage(AppointmentShow, {
      ...shared("Admin"), appointment: canceledView, actions: noActions, veterinarianId: null,
    });

    expect(scheduled).toContain("担当獣医師");
    expect(scheduled).toContain("未定");
    expect(scheduled).toContain("現在実行できる操作はありません");
    expect(checkedIn).toContain(checkedInAt);
    expect(checkedIn).not.toContain("診察開始日時");
    expect(examining).toContain(examinationStartedAt);
    expect(examining).toContain("Clinic Vet");
    expect(awaitingPayment).toContain("診察結果記録済み・会計待ち");
    expect(awaitingPayment).toContain("会計を記録");
    expect(awaitingPayment).not.toContain("診察結果を記録");
    expect(paid).toContain("private diagnosis");
    expect(paid).toContain("private treatment");
    expect(paid).toContain("診断");
    expect(paid).toContain("処置");
    expect(paid).toContain(`${paymentAmount} 円`);
    expect(paid).toContain("最終請求額");
    expect(paid).toContain(paidAt);
    expect(canceled).toContain(canceledAt);
    expect(canceled).not.toContain("受付日時");
  });

  test("renders lists and redacted event fields structurally without rebuilding hidden values", async () => {
    const appointments = await renderPage(AppointmentsIndex, {
      ...shared("Admin"),
      date: "2026-08-10",
      today: "2026-08-10",
      appointments: [scheduledView],
    });
    expect(appointments).not.toContain("Scheduled");
    expect(appointments).not.toContain("Hanako Owner");

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
        payloadSensitivity: "Sensitive",
      }],
    });
    expect(events).toContain("機微情報を含みます");
    expect(events).toContain("会計を記録");
    expect(events).not.toContain("diagnosis");
    expect(events).not.toContain("secret");
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
      scheduledAt: "2026-08-09T03:00:00.000Z",
      serviceCode: "GeneralConsultation",
      durationMinutes: "30",
      assignedVeterinarianId: "",
      reason: "Private visit reason",
    }, adminCookie);
    const appointment = database.select().from(appointmentsTable).get();
    if (appointment === undefined) throw new TypeError("appointment missing");
    const authorizedReceptionNote = "Authorized reception note";
    await post(app, `/appointments/${appointment.appointmentId}/reception-note`, {
      expectedVersion: "1",
      receptionNote: authorizedReceptionNote,
    }, adminCookie);
    await post(app, `/appointments/${appointment.appointmentId}/check-in`, {
      expectedVersion: "2",
    }, adminCookie);
    await post(app, `/appointments/${appointment.appointmentId}/start-examination`, {
      expectedVersion: "3",
    }, vetCookie);
    const privateFinding = "Highly sensitive clinical finding";
    await post(app, `/appointments/${appointment.appointmentId}/exam-results`, {
      petId: pet.petId,
      expectedVersion: "4",
      collectedAt: "2026-08-09T03:00:00.000Z",
      item: privateFinding,
      needsFollowUp: "true",
    }, vetCookie);
    await post(app, `/appointments/${appointment.appointmentId}/payment`, {
      diagnosis: "Private diagnosis",
      treatment: "Private treatment",
      finalAmount: "12500",
      expectedVersion: "5",
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
      authorizedReceptionNote,
    ];
    const appointmentDetailPath = `/appointments/${appointment.appointmentId}`;
    for (const path of ["/", "/appointments", "/reception", appointmentDetailPath, "/events"]) {
      const response = await app.request(path, { headers: { ...inertiaHeaders, Cookie: adminCookie } });
      const page = await response.json();
      const body = JSON.stringify(page);
      const valuesForbiddenOnThisPage = path === appointmentDetailPath
        ? forbiddenValues.filter((value) => ![
            "Private visit reason",
            "Private diagnosis",
            "Private treatment",
            authorizedReceptionNote,
          ].includes(value))
        : path === "/reception"
          ? forbiddenValues.filter((value) => value !== authorizedReceptionNote)
          : forbiddenValues;
      for (const value of valuesForbiddenOnThisPage) expect(body).not.toContain(value);
      if (path === appointmentDetailPath) {
        expect(body).toContain("Private visit reason");
        expect(body).toContain("Private diagnosis");
        expect(body).toContain("Private treatment");
      }
      if (path === "/reception") expect(body).toContain(authorizedReceptionNote);
      if (path === "/appointments" || path === "/reception" || path.startsWith("/appointments/")) {
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
          expect.objectContaining({ eventName: "appointment.final-settlement-recorded", eventId: expect.any(String) }),
          expect.objectContaining({ eventName: "exam-result.recorded", eventId: expect.any(String) }),
        ]),
      },
    });
    const eventBody = JSON.stringify(events);
    expect(events.props.events.every((event: Record<string, unknown>) =>
      event.payloadSensitivity === "Sensitive" &&
      !("regularPayload" in event) &&
      !("aggregateState" in event) &&
      !("eventPayload" in event),
    )).toBe(true);
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

    const rejectedReveal = await post(
      app,
      "/events/not-a-valid-event-id/sensitive-payload",
      {},
      vetCookie,
    );
    expect(rejectedReveal.status).toBe(403);
    const rejectedBody = await rejectedReveal.text();
    expect(rejectedBody).toBe("この監査情報を表示する権限がありません。");
    for (const value of forbiddenValues) expect(rejectedBody).not.toContain(value);

    const examResultEvent = events.props.events.find(
      (event: Record<string, unknown>) =>
        event.eventName === "exam-result.recorded",
    );
    expect(examResultEvent).toBeDefined();
    const revealResponse = await post(
      app,
      `/events/${String(examResultEvent?.eventId)}/sensitive-payload`,
      {},
      adminCookie,
    );
    const revealedBody = await revealResponse.text();
    expect(revealResponse.status).toBe(200);
    expect(revealResponse.headers.get("cache-control")).toContain("no-store");
    expect(revealResponse.headers.get("referrer-policy")).toBe("no-referrer");
    expect(revealedBody).toContain(privateFinding);
    expect(revealResponse.url).not.toContain(privateFinding);

    const eventsAfterReveal = await app.request("/events", {
      headers: { ...inertiaHeaders, Cookie: adminCookie },
    });
    const eventsAfterBody = await eventsAfterReveal.text();
    expect(eventsAfterBody).toContain("audit.sensitive-payload-viewed");
    for (const value of forbiddenValues) expect(eventsAfterBody).not.toContain(value);

    const invalid = await post(app, `/appointments/${appointment.appointmentId}/payment`, {
      diagnosis: "do not echo diagnosis",
      treatment: "do not echo treatment",
      finalAmount: "0",
      expectedVersion: "6",
    }, adminCookie);
    const invalidBody = await invalid.text();
    expect(invalidBody).not.toContain("do not echo diagnosis");
    expect(invalidBody).not.toContain("do not echo treatment");
  });
});
