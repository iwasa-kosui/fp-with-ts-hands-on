import type {
  ActionAvailability,
  AppointmentActions,
  ClinicPageProps,
} from "@fp-with-ts/clinic-web";

import { clinicFixture } from "../../../fixtures/clinic.js";
import type { Appointment } from "../domain/appointment/index.js";
import { toStatusLabel } from "../domain/appointment/index.js";

const hidden = { kind: "Hidden" } as const;
const available = (
  href: string,
  data?: Readonly<Record<string, string>>,
): ActionAvailability => data === undefined
  ? { kind: "Available", href, method: "post" }
  : { kind: "Available", href, method: "post", data };

const actionsFor = (appointment: Appointment): AppointmentActions => {
  const url = `/appointments/${appointment.appointmentId}`;
  const actions: AppointmentActions = {
    checkIn: hidden,
    startExamination: hidden,
    recordExamResult: hidden,
    recordPayment: hidden,
    cancel: hidden,
    requestFollowUp: {
      kind: "NotImplemented",
      href: "/follow-ups/request",
      method: "post",
    },
  };

  switch (appointment.kind) {
    case "Scheduled":
      return { ...actions, checkIn: available(`${url}/check-in`), cancel: available(`${url}/cancel`) };
    case "CheckedIn":
      return { ...actions, startExamination: available(`${url}/start-examination`), cancel: available(`${url}/cancel`) };
    case "InExamination":
      return {
        ...actions,
        recordExamResult: available(`${url}/exam-results`, {
          examId: clinicFixture.examId,
          petId: clinicFixture.petId,
          items: JSON.stringify(["skin"]),
          needsFollowUp: "false",
        }),
      };
    case "AwaitingPayment":
      return { ...actions, recordPayment: available(`${url}/payment`) };
    case "Paid":
    case "Canceled":
      return actions;
  }
};

export const toPageProps = (
  appointment: Appointment,
  notice: ClinicPageProps["notice"],
): ClinicPageProps => ({
  sessionLabel: "Session 07",
  learningFocus: "状態と監査イベントを一つの境界で保存する",
  appointment: {
    appointmentId: appointment.appointmentId,
    kind: appointment.kind,
    ownerName: clinicFixture.ownerContact.ownerName,
    petName: "Mugi",
    scheduledAt: appointment.scheduledAt,
    statusLabel: toStatusLabel(appointment),
  },
  actions: actionsFor(appointment),
  notice,
});
