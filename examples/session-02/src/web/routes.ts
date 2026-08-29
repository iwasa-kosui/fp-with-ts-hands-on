import { noticeFromCode, notImplemented } from "@fp-with-ts/clinic-web/server";
import type { Hono } from "hono";

import { clinicFixture } from "../../../fixtures/clinic.js";
import type { AppointmentStore } from "../adaptor/inMemoryAppointmentStore.js";
import type { Appointment, Scheduled } from "../domain/appointment/appointment.js";
import {
  cancel,
  checkIn,
  completeExamination,
  recordPayment,
  startExamination,
} from "../domain/appointment/transitions.js";
import { toPageProps } from "./appointmentView.js";

const appointmentOrThrow = (
  store: AppointmentStore,
  appointmentId: string,
): Appointment => {
  const appointment = store.find(appointmentId);
  if (appointment === undefined) {
    throw new Error("Appointment not found");
  }
  return appointment;
};

const initialAppointment: Scheduled = {
  kind: "Scheduled",
  appointmentId: clinicFixture.appointmentId,
  petId: clinicFixture.petId,
  ownerId: clinicFixture.ownerId,
  scheduledAt: clinicFixture.scheduledAt,
  reason: "skin check",
};

export const session02InitialAppointment = initialAppointment;

export const registerClinicRoutes = (
  app: Hono,
  store: AppointmentStore,
): void => {
  app.get("/", (context) =>
    context.render(
      "ClinicDashboard",
      toPageProps(
        appointmentOrThrow(store, clinicFixture.appointmentId),
        noticeFromCode(context.req.query("notice")),
      ),
    ),
  );

  app.post("/appointments/:appointmentId/check-in", (context) => {
    const current = appointmentOrThrow(store, context.req.param("appointmentId"));
    if (current.kind !== "Scheduled") throw new Error("Invalid appointment state");
    store.save(checkIn(current, clinicFixture.checkedInAt));
    return context.redirect("/", 303);
  });

  app.post("/appointments/:appointmentId/start-examination", (context) => {
    const current = appointmentOrThrow(store, context.req.param("appointmentId"));
    if (current.kind !== "CheckedIn") throw new Error("Invalid appointment state");
    store.save(
      startExamination(
        current,
        clinicFixture.veterinarianId,
        "2026-08-30T06:30:00.000Z",
      ),
    );
    return context.redirect("/", 303);
  });

  app.post("/appointments/:appointmentId/exam-results", async (context) => {
    const current = appointmentOrThrow(store, context.req.param("appointmentId"));
    if (current.kind !== "InExamination") throw new Error("Invalid appointment state");
    const raw = await context.req.json<Readonly<{ examId?: unknown }>>();
    store.save(
      completeExamination(
        current,
        { examId: typeof raw.examId === "string" ? raw.examId : clinicFixture.examId },
        "2026-08-30T07:00:00.000Z",
      ),
    );
    return context.redirect("/", 303);
  });

  app.post("/appointments/:appointmentId/payment", (context) => {
    const current = appointmentOrThrow(store, context.req.param("appointmentId"));
    if (current.kind !== "AwaitingPayment") throw new Error("Invalid appointment state");
    store.save(
      recordPayment(
        current,
        { diagnosis: "dermatitis", treatment: "ointment", amount: 4800 },
        "2026-08-30T07:10:00.000Z",
      ),
    );
    return context.redirect("/", 303);
  });

  app.post("/appointments/:appointmentId/cancel", (context) => {
    const current = appointmentOrThrow(store, context.req.param("appointmentId"));
    if (current.kind !== "Scheduled" && current.kind !== "CheckedIn") {
      throw new Error("Invalid appointment state");
    }
    store.save(cancel(current, "owner request", "2026-08-30T05:50:00.000Z"));
    return context.redirect("/", 303);
  });

  app.post("/follow-ups/request", notImplemented);
  app.post("/demo/reset", (context) => {
    store.reset();
    return context.redirect("/", 303);
  });
};
