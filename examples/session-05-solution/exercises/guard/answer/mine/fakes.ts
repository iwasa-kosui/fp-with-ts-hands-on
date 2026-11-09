import { okAsync } from "neverthrow";

import type { Paid, Scheduled } from "../../../../src/domain/appointment/appointment.js";
import { CancellationReason } from "../../../../src/domain/appointment/cancellationReason.js";
import type { CancelDependencies } from "../../../../src/useCase/cancelAppointment.js";

export const scheduled: Scheduled = {
  kind: "Scheduled",
  appointmentId: "appointment-1",
  scheduledAt: new Date("2026-01-10T09:00:00Z"),
  reason: "予防接種",
};

export const paid: Paid = {
  kind: "Paid",
  appointmentId: "appointment-2",
  scheduledAt: new Date("2026-01-10T10:00:00Z"),
  reason: "健康診断",
  checkedInAt: new Date("2026-01-10T10:05:00Z"),
  amount: 5000,
  paidAt: new Date("2026-01-10T11:00:00Z"),
};

export const validReason = CancellationReason.parse("予定が変わったため")._unsafeUnwrap();

export const clockAt = (now: Date): CancelDependencies["clock"] => ({ now: () => now });

export const resolverOf = (
  ...appointments: readonly (Scheduled | Paid)[]
): CancelDependencies["resolver"] => ({
  resolveById: (appointmentId) =>
    okAsync(appointments.find((appointment) => appointment.appointmentId === appointmentId)),
});

export const recordingStore = () => {
  const saved: Parameters<CancelDependencies["store"]["save"]>[0][] = [];
  const store: CancelDependencies["store"] = {
    save: (canceled) => {
      saved.push(canceled);
      return okAsync(undefined);
    },
  };
  return { store, saved };
};
