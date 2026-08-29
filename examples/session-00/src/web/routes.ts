import { randomUUID } from "node:crypto";

import { notImplemented } from "@fp-with-ts/clinic-web/server";
import type { Context, Hono } from "hono";

import { clinicFixture } from "../../../fixtures/clinic.js";
import type { AppointmentStore } from "../adaptor/secondary/sqlite/appointmentStore.js";
import { ExamResult } from "../boundary/examResult.js";
import {
  bookAppointment,
  updateStatus,
  type Appointment,
  type AppointmentExtra,
} from "../domain/appointment/appointment.js";
import {
  startExamination,
  startExaminationWithAuditFailure,
} from "../useCase/startExamination.js";
import { toPageProps } from "./appointmentView.js";

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
  store: AppointmentStore,
  appointmentId: string,
): Appointment => {
  const appointment = store.find(appointmentId);
  if (appointment === undefined) {
    throw new Error(`Appointment not found: ${appointmentId}`);
  }
  return appointment;
};

const updateAppointment = (
  store: AppointmentStore,
  appointmentId: string,
  status: string,
  eventName: string,
  occurredAt: string,
  extra?: AppointmentExtra,
): Appointment => {
  const appointment = appointmentOrThrow(store, appointmentId);
  const updated = updateStatus(appointment, status, extra);

  store.save(updated);
  store.appendAudit({
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
  store: AppointmentStore,
): void => {
  app.get("/", (context) => {
    const appointment = appointmentOrThrow(store, clinicFixture.appointmentId);
    return context.render(
      "ClinicDashboard",
      toPageProps(
        appointment,
        store.listAuditLogs(),
        context.req.query("notice"),
      ),
    );
  });

  app.post("/appointments/:appointmentId/check-in", (context) => {
    updateAppointment(
      store,
      context.req.param("appointmentId"),
      "checked-in",
      "appointment.checked-in",
      clinicFixture.checkedInAt,
      { checkedInAt: clinicFixture.checkedInAt },
    );
    return redirectToRoot(context);
  });

  app.post("/appointments/:appointmentId/start-examination", (context) => {
    startExamination(store)({
      appointmentId: context.req.param("appointmentId"),
      veterinarianId: clinicFixture.veterinarianId,
    });
    return redirectToRoot(context);
  });

  app.post("/appointments/:appointmentId/exam-results", (context) => {
    const raw = {
      petId: clinicFixture.petId,
      examId: clinicFixture.examId,
      examinationCompletedAt: "2026-08-30T07:00:00.000Z",
      diagnosis: "dermatitis",
      treatment: "ointment",
      items: ["skin observation"],
    };
    const examResult = ExamResult.parse(raw);

    updateAppointment(
      store,
      context.req.param("appointmentId"),
      "awaiting-payment",
      "examination.result-recorded",
      raw.examinationCompletedAt,
      examResult,
    );
    return redirectToRoot(context);
  });

  app.post("/appointments/:appointmentId/payment", (context) => {
    updateAppointment(
      store,
      context.req.param("appointmentId"),
      "paid",
      "payment.recorded",
      "2026-08-30T07:10:00.000Z",
      {
        amount: 4800,
        paidAt: "2026-08-30T07:10:00.000Z",
      },
    );
    return redirectToRoot(context);
  });

  app.post("/appointments/:appointmentId/cancel", (context) => {
    updateAppointment(
      store,
      context.req.param("appointmentId"),
      "canceled",
      "appointment.canceled",
      new Date().toISOString(),
      { cancelReason: "owner request" },
    );
    return redirectToRoot(context);
  });

  app.post("/follow-ups/request", notImplemented);

  app.post("/demo/incidents/unknown-status", (context) => {
    updateAppointment(
      store,
      clinicFixture.appointmentId,
      "waiting-for-magic",
      "appointment.status-updated",
      new Date().toISOString(),
    );
    return redirectToRoot(context);
  });

  app.post("/demo/incidents/swap-identifiers", (context) => {
    updateAppointment(
      store,
      clinicFixture.appointmentId,
      "scheduled",
      "appointment.identifiers-updated",
      new Date().toISOString(),
      { petId: clinicFixture.ownerId },
    );
    return redirectToRoot(context);
  });

  app.post("/demo/incidents/malformed-exam-result", (context) => {
    const raw = {
      petId: "not-a-pet-id",
      examId: clinicFixture.examId,
      examinationCompletedAt: "2026-08-30T07:00:00.000Z",
      diagnosis: "dermatitis",
      treatment: "ointment",
      items: "not-an-array",
    };
    const examResult = ExamResult.parse(raw);

    updateAppointment(
      store,
      clinicFixture.appointmentId,
      "awaiting-payment",
      "examination.result-recorded",
      raw.examinationCompletedAt,
      examResult,
    );
    return redirectToRoot(context);
  });

  app.post("/demo/incidents/missing-appointment", (context) => {
    try {
      startExamination(store)({
        appointmentId: "55555555-5555-4555-8555-555555555555",
        veterinarianId: clinicFixture.veterinarianId,
      });
    } catch (error: any) {
      if (error.message.includes("Appointment not found")) {
        return context.redirect("/?notice=invalid-state", 303);
      }
      throw error;
    }

    return redirectToRoot(context);
  });

  app.post("/demo/incidents/repeat-start-examination", (context) => {
    const input = {
      appointmentId: clinicFixture.appointmentId,
      veterinarianId: clinicFixture.veterinarianId,
    };
    startExamination(store)(input);
    startExamination(store)(input);
    return redirectToRoot(context);
  });

  app.post("/demo/incidents/audit-failure", (context) => {
    try {
      startExaminationWithAuditFailure(store)({
        appointmentId: clinicFixture.appointmentId,
        veterinarianId: clinicFixture.veterinarianId,
      });
    } catch {
      return context.redirect("/?notice=conflict", 303);
    }

    return redirectToRoot(context);
  });

  app.post("/demo/reset", (context) => {
    store.reset(initialAppointment);
    return redirectToRoot(context);
  });
};
