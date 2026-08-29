import { randomUUID } from "node:crypto";

import type { ClinicPageProps } from "@fp-with-ts/clinic-web";
import { noticeFromCode, notImplemented } from "@fp-with-ts/clinic-web/server";
import type { Context, Hono } from "hono";

import { clinicFixture } from "../../../fixtures/clinic.js";
import type { AppointmentRepository } from "../adaptor/secondary/sqlite/appointmentRepository.js";
import {
  bookAppointment,
  updateStatus,
  type Appointment,
  type AppointmentExtra,
} from "../domain/appointment/appointment.js";
import { startExamination } from "../useCase/startExamination.js";

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

export const initialAppointment: Appointment = bookAppointment({
  appointmentId: clinicFixture.appointmentId,
  petId: clinicFixture.petId,
  petName: "Mugi",
  ownerId: clinicFixture.ownerId,
  ...clinicFixture.ownerContact,
  scheduledAt: clinicFixture.scheduledAt,
  reason: "skin check",
});

const appointmentOrThrow = (
  repository: AppointmentRepository,
  appointmentId: string,
): Appointment => {
  const appointment = repository.find(appointmentId);
  if (appointment === undefined) {
    throw new Error(`Appointment not found: ${appointmentId}`);
  }
  return appointment;
};

const toPageProps = (
  appointment: Appointment,
  noticeCode: string | undefined,
): ClinicPageProps => {
  const presentation = statusPresentation[appointment.status] ?? {
    kind: appointment.status,
    label: appointment.status,
  };
  const action = (path: string) =>
    ({ kind: "Available", href: path, method: "post" }) as const;
  const appointmentUrl = `/appointments/${appointment.appointmentId}`;

  return {
    sessionLabel: "Session 01",
    learningFocus: "操作を業務イベントとワークフローとして捉える",
    appointment: {
      appointmentId: appointment.appointmentId,
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

const updateAppointment = (
  repository: AppointmentRepository,
  appointmentId: string,
  status: string,
  eventName: string,
  occurredAt: string,
  extra?: AppointmentExtra,
): Appointment => {
  const appointment = appointmentOrThrow(repository, appointmentId);
  const updated = updateStatus(appointment, status, extra);
  repository.save(updated);
  repository.appendAudit({
    eventId: randomUUID(),
    eventName,
    occurredAt,
    appointment: updated,
  });
  return updated;
};

const redirectToRoot = (context: Context) => context.redirect("/", 303);

export const registerClinicRoutes = (
  app: Hono,
  repository: AppointmentRepository,
): void => {
  app.get("/", (context) =>
    context.render(
      "ClinicDashboard",
      toPageProps(
        appointmentOrThrow(repository, clinicFixture.appointmentId),
        context.req.query("notice"),
      ),
    ),
  );

  app.post("/appointments/:appointmentId/check-in", (context) => {
    updateAppointment(
      repository,
      context.req.param("appointmentId"),
      "checked-in",
      "appointment.checked-in",
      clinicFixture.checkedInAt,
      { checkedInAt: clinicFixture.checkedInAt },
    );
    return redirectToRoot(context);
  });

  app.post("/appointments/:appointmentId/start-examination", (context) => {
    startExamination(repository)({
      appointmentId: context.req.param("appointmentId"),
      veterinarianId: clinicFixture.veterinarianId,
    });
    return redirectToRoot(context);
  });

  app.post("/appointments/:appointmentId/exam-results", (context) => {
    updateAppointment(
      repository,
      context.req.param("appointmentId"),
      "awaiting-payment",
      "examination.result-recorded",
      "2026-08-30T07:00:00.000Z",
      {
        examId: clinicFixture.examId,
        examinationCompletedAt: "2026-08-30T07:00:00.000Z",
        diagnosis: "dermatitis",
        treatment: "ointment",
      },
    );
    return redirectToRoot(context);
  });

  app.post("/appointments/:appointmentId/payment", (context) => {
    updateAppointment(
      repository,
      context.req.param("appointmentId"),
      "paid",
      "payment.recorded",
      "2026-08-30T07:10:00.000Z",
      { amount: 4800, paidAt: "2026-08-30T07:10:00.000Z" },
    );
    return redirectToRoot(context);
  });

  app.post("/appointments/:appointmentId/cancel", (context) => {
    updateAppointment(
      repository,
      context.req.param("appointmentId"),
      "canceled",
      "appointment.canceled",
      new Date().toISOString(),
      { cancelReason: "owner request" },
    );
    return redirectToRoot(context);
  });

  app.post("/follow-ups/request", notImplemented);
  app.post("/demo/reset", (context) => {
    repository.reset(initialAppointment);
    return redirectToRoot(context);
  });
};
