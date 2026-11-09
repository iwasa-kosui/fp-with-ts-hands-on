// このファイルを書き換えて、隣の人の仕組みで検出されない誤った変更を作成します
import { ResultAsync } from "neverthrow";

import type { EventContext } from "../../../src/domain/aggregate/eventContext.js";
import type {
  Appointment as AppointmentState,
  AppointmentId,
  CheckedIn,
  ExaminationStarted,
  InExamination,
  VeterinarianId,
} from "../../../src/domain/appointment/index.js";
import { Appointment } from "../../../src/domain/appointment/index.js";
import type {
  EffectsDependencies,
  EventContextDependencies,
} from "../../../src/useCase/dependencies.js";
import {
  ensureAppointmentFound,
  ensureCheckedIn,
  type StartExaminationWithEffectsError,
} from "../../../src/useCase/errors.js";
import type { StartExaminationWithEffectsInput } from "../../../src/useCase/startExamination.js";

const createEventContext = (deps: EventContextDependencies): EventContext => ({
  eventId: deps.eventIdGenerator.generate(),
  occurredAt: deps.clock.now(),
});

const resolveAppointment =
  (deps: EffectsDependencies) =>
  (appointmentId: AppointmentId): ResultAsync<AppointmentState | undefined, never> =>
    ResultAsync.fromSafePromise(
      Promise.resolve().then(() => deps.resolver.resolveById(appointmentId)),
    );

const ensureFound =
  (appointmentId: AppointmentId) =>
  (appointment: AppointmentState | undefined) =>
    ensureAppointmentFound(appointment, appointmentId);

const startExaminationEvent =
  (deps: EffectsDependencies, veterinarianId: VeterinarianId) =>
  (appointment: CheckedIn): ExaminationStarted =>
    Appointment.startExamination(createEventContext(deps))(
      appointment,
      veterinarianId,
    );

export const startExaminationWithEffects =
  (deps: EffectsDependencies) =>
  (
    input: StartExaminationWithEffectsInput,
  ): ResultAsync<InExamination, StartExaminationWithEffectsError> =>
    resolveAppointment(deps)(input.appointmentId)
      .andThen(ensureFound(input.appointmentId))
      .andThen(ensureCheckedIn)
      .map(startExaminationEvent(deps, input.veterinarianId))
      .andThrough(deps.examinationStartedStore.store)
      .map((event) => event.aggregateState);
