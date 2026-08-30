import { randomUUID } from "node:crypto";

import { noticeFromCode, notImplemented } from "@fp-with-ts/clinic-web/server";
import type { Hono } from "hono";

import { clinicFixture } from "../../../fixtures/clinic.js";
import type {
  AppointmentRepository,
  PersistenceContext,
} from "../adaptor/secondary/sqlite/appointmentRepository.js";
import type { Appointment, Scheduled } from "../domain/appointment/index.js";
import {
  cancel,
  checkIn,
  completeExamination,
  recordPayment,
  startExamination,
} from "../domain/appointment/index.js";
import { AppointmentId } from "../domain/appointment/index.js";
import { ExamId } from "../domain/examResult/index.js";
import { OwnerId } from "../domain/owner/index.js";
import { PetId } from "../domain/pet/index.js";
import { VeterinarianId } from "../domain/appointment/index.js";
import { toPageProps } from "./appointmentView.js";

const ids = {
  appointmentId: AppointmentId.parse(clinicFixture.appointmentId),
  examId: ExamId.parse(clinicFixture.examId),
  ownerId: OwnerId.parse(clinicFixture.ownerId),
  petId: PetId.parse(clinicFixture.petId),
  veterinarianId: VeterinarianId.parse(clinicFixture.veterinarianId),
};

const appointmentOrThrow = (
  repository: AppointmentRepository,
  appointmentId: string,
): Appointment => {
  const appointment = repository.find(appointmentId);
  if (appointment === undefined) throw new Error("Appointment not found");
  return appointment;
};

export const session03InitialAppointment: Scheduled = {
  kind: "Scheduled",
  appointmentId: ids.appointmentId,
  petId: ids.petId,
  ownerId: ids.ownerId,
  scheduledAt: clinicFixture.scheduledAt,
  reason: "skin check",
};

export const session03PersistenceContext: PersistenceContext = {
  ownerContact: clinicFixture.ownerContact,
};

const saveAndAppendAudit = (
  repository: AppointmentRepository,
  appointment: Appointment,
  eventName: string,
  occurredAt: string,
): void => {
  repository.save(appointment);
  repository.appendAudit({
    eventId: randomUUID(),
    eventName,
    occurredAt,
    appointment,
    payload: {},
  });
};

export const registerClinicRoutes = (
  app: Hono,
  repository: AppointmentRepository,
): void => {
  app.get("/", (context) =>
    context.render(
      "ClinicDashboard",
      toPageProps(
        appointmentOrThrow(repository, clinicFixture.appointmentId),
        noticeFromCode(context.req.query("notice")),
      ),
    ),
  );

  app.post("/appointments/:appointmentId/check-in", (context) => {
    const current = appointmentOrThrow(repository, context.req.param("appointmentId"));
    if (current.kind !== "Scheduled") throw new Error("Invalid appointment state");
    saveAndAppendAudit(
      repository,
      checkIn(current, clinicFixture.checkedInAt),
      "AppointmentCheckedIn",
      clinicFixture.checkedInAt,
    );
    return context.redirect("/", 303);
  });

  app.post("/appointments/:appointmentId/start-examination", (context) => {
    const current = appointmentOrThrow(repository, context.req.param("appointmentId"));
    if (current.kind !== "CheckedIn") throw new Error("Invalid appointment state");
    saveAndAppendAudit(
      repository,
      startExamination(
        current,
        ids.veterinarianId,
        "2026-08-30T06:30:00.000Z",
      ),
      "ExaminationStarted",
      "2026-08-30T06:30:00.000Z",
    );
    return context.redirect("/", 303);
  });

  app.post("/appointments/:appointmentId/exam-results", async (context) => {
    const current = appointmentOrThrow(repository, context.req.param("appointmentId"));
    if (current.kind !== "InExamination") throw new Error("Invalid appointment state");
    const raw = await context.req.json<Readonly<{ examId?: unknown }>>();
    const examId = ExamId.parse(
      typeof raw.examId === "string" ? raw.examId : ids.examId,
    );
    saveAndAppendAudit(
      repository,
      completeExamination(
        current,
        { examId },
        "2026-08-30T07:00:00.000Z",
      ),
      "ExaminationCompleted",
      "2026-08-30T07:00:00.000Z",
    );
    return context.redirect("/", 303);
  });

  app.post("/appointments/:appointmentId/payment", (context) => {
    const current = appointmentOrThrow(repository, context.req.param("appointmentId"));
    if (current.kind !== "AwaitingPayment") throw new Error("Invalid appointment state");
    saveAndAppendAudit(
      repository,
      recordPayment(
        current,
        { diagnosis: "dermatitis", treatment: "ointment", amount: 4800 },
        "2026-08-30T07:10:00.000Z",
      ),
      "PaymentRecorded",
      "2026-08-30T07:10:00.000Z",
    );
    return context.redirect("/", 303);
  });

  app.post("/appointments/:appointmentId/cancel", (context) => {
    const current = appointmentOrThrow(repository, context.req.param("appointmentId"));
    if (current.kind !== "Scheduled" && current.kind !== "CheckedIn") {
      throw new Error("Invalid appointment state");
    }
    saveAndAppendAudit(
      repository,
      cancel(current, "owner request", "2026-08-30T05:50:00.000Z"),
      "AppointmentCanceled",
      "2026-08-30T05:50:00.000Z",
    );
    return context.redirect("/", 303);
  });

  app.post("/follow-ups/request", notImplemented);
  app.post("/demo/reset", (context) => {
    repository.reset(session03InitialAppointment, session03PersistenceContext);
    return context.redirect("/", 303);
  });
};
