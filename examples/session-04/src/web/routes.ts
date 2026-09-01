import { randomUUID } from "node:crypto";

import { noticeFromCode, notImplemented } from "@fp-with-ts/clinic-web/server";
import type { Context, Hono } from "hono";

import { clinicFixture } from "../../../fixtures/clinic.js";
import type {
  AppointmentRepository,
  PersistenceContext,
} from "../adaptor/secondary/sqlite/appointmentRepository.js";
import { ExamResult } from "../boundary/examResult.js";
import { StartExaminationInput } from "../boundary/startExaminationInput.js";
import type { Appointment, Scheduled } from "../domain/appointment/index.js";
import {
  cancel,
  checkIn,
  completeExamination,
  recordPayment,
  startExamination,
} from "../domain/appointment/index.js";
import { AppointmentId } from "../domain/appointment/index.js";
import { OwnerId } from "../domain/owner/index.js";
import { PetId } from "../domain/pet/index.js";
import { toPageProps } from "./appointmentView.js";

const ids = {
  appointmentId: AppointmentId.parse(clinicFixture.appointmentId),
  ownerId: OwnerId.parse(clinicFixture.ownerId),
  petId: PetId.parse(clinicFixture.petId),
};

const appointmentOrThrow = (
  repository: AppointmentRepository,
  appointmentId: string,
): Appointment => {
  const appointment = repository.find(appointmentId);
  if (appointment === undefined) throw new Error("Appointment not found");
  return appointment;
};

const decodeExamPayload = async (context: Context) => {
  const raw = await context.req.json<Record<string, unknown>>();
  return {
    ...raw,
    items: typeof raw.items === "string" ? JSON.parse(raw.items) : raw.items,
    needsFollowUp: raw.needsFollowUp === "true"
      ? true
      : raw.needsFollowUp === "false"
        ? false
        : raw.needsFollowUp,
  };
};

export const session04InitialAppointment: Scheduled = {
  kind: "Scheduled",
  appointmentId: ids.appointmentId,
  petId: ids.petId,
  ownerId: ids.ownerId,
  scheduledAt: clinicFixture.scheduledAt,
  reason: "skin check",
};

export const session04PersistenceContext: PersistenceContext = {
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

  app.post("/appointments/:appointmentId/start-examination", async (context) => {
    const raw = await context.req.json<Readonly<{ veterinarianId?: unknown }>>();
    const input = StartExaminationInput.parse({
      appointmentId: context.req.param("appointmentId"),
      veterinarianId: raw.veterinarianId,
    })._unsafeUnwrap();
    const current = appointmentOrThrow(repository, input.appointmentId);
    if (current.kind !== "CheckedIn") throw new Error("Invalid appointment state");
    saveAndAppendAudit(
      repository,
      startExamination(
        current,
        input.veterinarianId,
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
    const parsed = ExamResult.parse(await decodeExamPayload(context));
    if (parsed.isErr()) throw new Error("Invalid exam result");
    const examResult = parsed._unsafeUnwrap();
    saveAndAppendAudit(
      repository,
      completeExamination(
        current,
        { examId: examResult.examId },
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
    repository.reset(session04InitialAppointment, session04PersistenceContext);
    return context.redirect("/", 303);
  });
};
