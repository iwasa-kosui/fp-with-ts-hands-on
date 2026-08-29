import type { ClinicPageProps } from "@fp-with-ts/clinic-web";
import {
  noticeFromCode,
  notImplemented,
} from "@fp-with-ts/clinic-web/server";
import type { Hono } from "hono";

import { clinicFixture } from "../../../fixtures/clinic.js";
import {
  bookAppointment,
  findAppointment,
  resetLegacyStore,
  updateStatus,
  type LegacyAppointment,
} from "../legacy/appointment.js";

const statusPresentation: Readonly<
  Record<string, Readonly<{ kind: string; label: string }>>
> = {
  scheduled: { kind: "Scheduled", label: "予約済み" },
  "checked-in": { kind: "CheckedIn", label: "受付済み" },
  "in-examination": { kind: "InExamination", label: "診察中" },
  "awaiting-payment": { kind: "AwaitingPayment", label: "会計待ち" },
  paid: { kind: "Paid", label: "会計済み" },
  canceled: { kind: "Canceled", label: "キャンセル済み" },
};

const seedAppointment = (): LegacyAppointment => {
  resetLegacyStore();
  return bookAppointment({
    id: clinicFixture.appointmentId,
    petId: clinicFixture.petId,
    petName: "Mugi",
    ownerId: clinicFixture.ownerId,
    ...clinicFixture.ownerContact,
    scheduledAt: clinicFixture.scheduledAt,
    reason: "skin check",
  });
};

const appointmentOrThrow = (id: string): LegacyAppointment => {
  const appointment = findAppointment(id);
  if (appointment === undefined) {
    throw new Error(`Appointment not found: ${id}`);
  }
  return appointment;
};

const toPageProps = (
  appointment: LegacyAppointment,
  noticeCode: string | undefined,
): ClinicPageProps => {
  const presentation = statusPresentation[appointment.status] ?? {
    kind: appointment.status,
    label: appointment.status,
  };
  const action = (path: string) =>
    ({ kind: "Available", href: path, method: "post" }) as const;
  const appointmentUrl = `/appointments/${appointment.id}`;

  return {
    sessionLabel: "Session 01",
    learningFocus: "操作を業務イベントとワークフローとして捉える",
    appointment: {
      appointmentId: appointment.id,
      kind: presentation.kind,
      ownerName: appointment.ownerName,
      petName: appointment.petName,
      scheduledAt: appointment.scheduledAt,
      statusLabel: presentation.label,
    },
    actions: {
      checkIn: action(`${appointmentUrl}/check-in`),
      startExamination: action(`${appointmentUrl}/start-examination`),
      recordExamResult: action(`${appointmentUrl}/exam-results`),
      recordPayment: action(`${appointmentUrl}/payment`),
      cancel: action(`${appointmentUrl}/cancel`),
      requestFollowUp: {
        kind: "NotImplemented",
        href: "/follow-ups/request",
        method: "post",
      },
    },
    notice: noticeFromCode(noticeCode),
  };
};

export const registerClinicRoutes = (app: Hono): void => {
  app.get("/", (context) =>
    context.render(
      "ClinicDashboard",
      toPageProps(
        appointmentOrThrow(clinicFixture.appointmentId),
        context.req.query("notice"),
      ),
    ),
  );

  app.post("/appointments/:appointmentId/check-in", (context) => {
    updateStatus(context.req.param("appointmentId"), "checked-in", {
      checkedInAt: clinicFixture.checkedInAt,
    });
    return context.redirect("/", 303);
  });

  app.post("/appointments/:appointmentId/start-examination", (context) => {
    updateStatus(context.req.param("appointmentId"), "in-examination", {
      veterinarianId: clinicFixture.veterinarianId,
    });
    return context.redirect("/", 303);
  });

  app.post("/appointments/:appointmentId/exam-results", (context) => {
    updateStatus(context.req.param("appointmentId"), "awaiting-payment", {
      examId: clinicFixture.examId,
      examinationCompletedAt: "2026-08-30T07:00:00.000Z",
      diagnosis: "dermatitis",
      treatment: "ointment",
    });
    return context.redirect("/", 303);
  });

  app.post("/appointments/:appointmentId/payment", (context) => {
    updateStatus(context.req.param("appointmentId"), "paid", {
      amount: 4800,
      paidAt: "2026-08-30T07:10:00.000Z",
    });
    return context.redirect("/", 303);
  });

  app.post("/appointments/:appointmentId/cancel", (context) => {
    updateStatus(context.req.param("appointmentId"), "canceled", {
      cancelReason: "owner request",
    });
    return context.redirect("/", 303);
  });

  app.post("/follow-ups/request", notImplemented);
  app.post("/demo/reset", (context) => {
    seedAppointment();
    return context.redirect("/", 303);
  });
};

export const resetDemo = (): LegacyAppointment => seedAppointment();
