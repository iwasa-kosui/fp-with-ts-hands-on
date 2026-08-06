import { err, ok, type Result } from "neverthrow";

import { Appointment, type CheckedIn, type InExamination } from "../domain/appointment.js";
import type { AppointmentId } from "../domain/appointment-id.js";
import { ExaminationStarted } from "../domain/examination-started.js";
import type { AppointmentResolver } from "../ports/appointment-resolver.js";
import type { AppointmentStore } from "../ports/appointment-store.js";
import type { StartExaminationError } from "./start-examination-error.js";
import { StartExaminationInput } from "./start-examination-input.js";

type ExaminationTransition = Readonly<{
  state: InExamination;
  event: ExaminationStarted;
}>;

const ensureFound =
  (appointmentId: AppointmentId) =>
  (
    appointment: Appointment | undefined,
  ): Result<Appointment, StartExaminationError> =>
    appointment === undefined
      ? err({ kind: "AppointmentNotFound", appointmentId })
      : ok(appointment);

const ensureCheckedIn = (
  appointment: Appointment,
): Result<CheckedIn, StartExaminationError> =>
  appointment.kind === "CheckedIn"
    ? ok(appointment)
    : err({
        kind: "InvalidAppointmentState",
        appointmentId: appointment.appointmentId,
        expectedKind: "CheckedIn",
        actualKind: appointment.kind,
      });

const transition = (
  input: StartExaminationInput,
  checkedIn: CheckedIn,
): ExaminationTransition => {
  const state = Appointment.startExamination(
    checkedIn,
    input.veterinarianId,
    input.occurredAt,
  );

  return {
    state,
    event: ExaminationStarted.create({
      eventId: input.eventId,
      occurredAt: input.occurredAt,
      appointmentId: state.appointmentId,
      veterinarianId: state.veterinarianId,
    }),
  };
};

export const startExaminationUseCase = (
  resolver: AppointmentResolver,
  store: AppointmentStore,
) =>
  (raw: unknown): Result<InExamination, StartExaminationError> =>
    StartExaminationInput.parse(raw).andThen((input) =>
      resolver
        .findById(input.appointmentId)
        .andThen(ensureFound(input.appointmentId))
        .andThen(ensureCheckedIn)
        .map((checkedIn) => transition(input, checkedIn))
        .andThrough(({ state, event }) => store.save(state, [event]))
        .map(({ state }) => state),
    );
