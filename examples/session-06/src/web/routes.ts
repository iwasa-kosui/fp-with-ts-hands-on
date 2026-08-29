import { noticeFromCode, notImplemented } from "@fp-with-ts/clinic-web/server";
import type { Context, Hono } from "hono";

import { clinicFixture } from "../../../fixtures/clinic.js";
import type { AppointmentStore } from "../adaptor/inMemoryAppointmentStore.js";
import { ExamResult } from "../boundary/examResult.js";
import { StartExaminationInput } from "../boundary/startExaminationInput.js";
import { EventId } from "../domain/aggregate/eventId.js";
import type { Appointment, Scheduled } from "../domain/appointment/index.js";
import {
  cancel,
  checkIn,
  completeExamination,
  recordPayment,
} from "../domain/appointment/index.js";
import { AppointmentId } from "../domain/appointment/index.js";
import { OwnerId } from "../domain/owner/index.js";
import { PetId } from "../domain/pet/index.js";
import type { StartExaminationWithEffectsError } from "../useCase/errors.js";
import { startExaminationWithEffects } from "../useCase/startExamination.js";
import { toPageProps } from "./appointmentView.js";
import type { StartExaminationError } from "../useCase/errors.js";

type StartExaminationNoticeCode = "not-found" | "invalid-state";

export const startExaminationNoticeCodes: Readonly<
  Record<StartExaminationError["kind"], StartExaminationNoticeCode>
> = {
  AppointmentNotFound: "not-found",
  InvalidAppointmentState: "invalid-state",
};

const assertNever = (error: never): never => {
  throw new Error(`Unhandled start examination error: ${JSON.stringify(error)}`);
};

const toStartExaminationNoticeCode = (
  error: StartExaminationError,
): StartExaminationNoticeCode => {
  switch (error.kind) {
    case "AppointmentNotFound":
      return startExaminationNoticeCodes.AppointmentNotFound;
    case "InvalidAppointmentState":
      return startExaminationNoticeCodes.InvalidAppointmentState;
    default:
      return assertNever(error);
  }
};

type StartExaminationWithEffectsNoticeCode =
  | StartExaminationNoticeCode
  | "conflict";

const toStartExaminationWithEffectsNoticeCode = (
  error: StartExaminationWithEffectsError,
): StartExaminationWithEffectsNoticeCode =>
  error.kind === "AppointmentConflict"
    ? "conflict"
    : toStartExaminationNoticeCode(error);

const ids = {
  appointmentId: AppointmentId.parse(clinicFixture.appointmentId),
  eventId: EventId.parse("55555555-5555-4555-8555-555555555555"),
  ownerId: OwnerId.parse(clinicFixture.ownerId),
  petId: PetId.parse(clinicFixture.petId),
};

const appointmentOrThrow = (store: AppointmentStore, appointmentId: string): Appointment => {
  const appointment = store.find(appointmentId);
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

export const session06InitialAppointment: Scheduled = {
  kind: "Scheduled",
  appointmentId: ids.appointmentId,
  petId: ids.petId,
  ownerId: ids.ownerId,
  scheduledAt: clinicFixture.scheduledAt,
  reason: "skin check",
};

export const registerClinicRoutes = (app: Hono, store: AppointmentStore): void => {
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

  app.post("/appointments/:appointmentId/start-examination", async (context) => {
    const input = StartExaminationInput.parse({
      appointmentId: context.req.param("appointmentId"),
      veterinarianId: clinicFixture.veterinarianId,
    })._unsafeUnwrap();
    const dependencies = {
      resolver: store,
      stateStore: store.stateStore,
      eventLog: store.eventLog,
      clock: { now: () => "2026-08-30T06:30:00.000Z" },
      eventIdGenerator: { generate: () => ids.eventId },
      store: store.atomicStore,
    };
    const result = await startExaminationWithEffects(dependencies)({
      ...input,
    });
    return result.match(
      () => context.redirect("/", 303),
      (error) =>
        context.redirect(
          `/?notice=${toStartExaminationWithEffectsNoticeCode(error)}`,
          303,
        ),
    );
  });

  app.post("/appointments/:appointmentId/exam-results", async (context) => {
    const current = appointmentOrThrow(store, context.req.param("appointmentId"));
    if (current.kind !== "InExamination") throw new Error("Invalid appointment state");
    const parsed = ExamResult.parse(await decodeExamPayload(context));
    if (parsed.isErr()) throw new Error("Invalid exam result");
    store.save(completeExamination(
      current,
      { examId: parsed._unsafeUnwrap().examId },
      "2026-08-30T07:00:00.000Z",
    ));
    return context.redirect("/", 303);
  });

  app.post("/appointments/:appointmentId/payment", (context) => {
    const current = appointmentOrThrow(store, context.req.param("appointmentId"));
    if (current.kind !== "AwaitingPayment") throw new Error("Invalid appointment state");
    store.save(recordPayment(
      current,
      { diagnosis: "dermatitis", treatment: "ointment", amount: 4800 },
      "2026-08-30T07:10:00.000Z",
    ));
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
