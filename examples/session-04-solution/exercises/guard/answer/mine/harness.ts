import type { Appointment, CheckedIn, InExamination, Scheduled } from "../../../../src/domain/appointment/index.js";
import { AppointmentId, VeterinarianId } from "../../../../src/domain/appointment/index.js";
import { OwnerId } from "../../../../src/domain/owner/index.js";
import { PetId } from "../../../../src/domain/pet/index.js";
import type { Dependencies } from "../../../../src/useCase/dependencies.js";

export const input = {
  appointmentId: AppointmentId.parse("11111111-1111-4111-8111-111111111111"),
  veterinarianId: VeterinarianId.parse("44444444-4444-4444-8444-444444444444"),
  examinationStartedAt: "2026-08-30T06:30:00.000Z",
} as const;

export const scheduled = {
  kind: "Scheduled",
  appointmentId: input.appointmentId,
  petId: PetId.parse("22222222-2222-4222-8222-222222222222"),
  ownerId: OwnerId.parse("33333333-3333-4333-8333-333333333333"),
  scheduledAt: "2026-08-30T06:30:00.000Z",
  reason: "skin check",
} as const satisfies Scheduled;

export const checkedIn = {
  ...scheduled,
  kind: "CheckedIn",
  checkedInAt: "2026-08-30T06:20:00.000Z",
} as const satisfies CheckedIn;

export const fakeDependencies = (
  options: Readonly<{ resolved: Appointment | undefined; saveError?: Error }>,
) => {
  const saved: InExamination[] = [];
  const dependencies: Dependencies = {
    resolver: { resolveById: () => options.resolved },
    store: {
      save: (appointment) => {
        saved.push(appointment);
        if (options.saveError !== undefined) {
          throw options.saveError;
        }
      },
    },
  };
  return { dependencies, saved };
};

export type Outcome<T> =
  | Readonly<{ kind: "returned"; value: T }>
  | Readonly<{ kind: "threw"; error: unknown }>;

export const call = <T>(run: () => T): Outcome<T> => {
  try {
    return { kind: "returned", value: run() };
  } catch (error) {
    return { kind: "threw", error };
  }
};
