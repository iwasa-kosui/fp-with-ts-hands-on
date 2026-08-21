// @ts-nocheck
import type { Scheduled } from "../../../src/domain/appointment/appointment.js";
import { checkIn, startExamination } from "../../../src/domain/appointment/transitions.js";
import { AppointmentId } from "../../../src/domain/ids/appointmentId.js";
import { OwnerId } from "../../../src/domain/ids/ownerId.js";
import { PetId } from "../../../src/domain/ids/petId.js";
import { clinicFixture } from "../../../../fixtures/clinic.js";

const scheduled: Scheduled = {
  kind: "Scheduled",
  appointmentId: AppointmentId.parse(clinicFixture.appointmentId),
  petId: PetId.parse(clinicFixture.petId),
  ownerId: OwnerId.parse(clinicFixture.ownerId),
  scheduledAt: clinicFixture.scheduledAt,
  reason: "定期健診",
};

// @ts-expect-error 飼い主の識別子を、ペットの識別子として使えません。
const swapped: Scheduled = { ...scheduled, petId: scheduled.ownerId };

const checkedIn = checkIn(scheduled, clinicFixture.checkedInAt);

// @ts-expect-error 予約の識別子を、担当獣医師の識別子として渡せません。
const inExamination = startExamination(checkedIn, scheduled.appointmentId, clinicFixture.scheduledAt);