import type { Scheduled } from "./appointment/appointment.js";
import { checkIn, startExamination } from "./appointment/transitions.js";
import type { PetId } from "./ids/petId.js";

declare const scheduled: Scheduled;

const acceptPetId = (_petId: PetId): void => undefined;

// @ts-expect-error 飼い主の識別子を、ペットの識別子として渡せません。
acceptPetId(scheduled.ownerId);

const checkedIn = checkIn(scheduled, "2026-08-30T06:20:00.000Z");

// @ts-expect-error 予約の識別子を、担当獣医師の識別子として渡せません。
startExamination(checkedIn, scheduled.appointmentId, "2026-08-30T06:30:00.000Z");
