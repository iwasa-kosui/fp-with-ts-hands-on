// @ts-nocheck
import type { Scheduled } from "../../../src/domain/appointment/index.js";
import {
  checkIn,
  startExamination,
} from "../../../src/domain/appointment/index.js";
import { AppointmentId } from "../../../src/domain/appointment/index.js";
import { OwnerId } from "../../../src/domain/owner/index.js";
import { PetId } from "../../../src/domain/pet/index.js";
import { VeterinarianId } from "../../../src/domain/appointment/index.js";
import { clinicFixture } from "../../../../fixtures/clinic.js";

const scheduled: Scheduled = {
  kind: "Scheduled",
  appointmentId: AppointmentId.parse(clinicFixture.appointmentId),
  petId: PetId.parse(clinicFixture.petId),
  ownerId: OwnerId.parse(clinicFixture.ownerId),
  scheduledAt: clinicFixture.scheduledAt,
  reason: "定期健診",
};

const acceptAppointmentId = (_id: AppointmentId): void => undefined;
acceptAppointmentId(scheduled.appointmentId);

const checkedIn = checkIn(scheduled, clinicFixture.checkedInAt);
const veterinarianId = VeterinarianId.parse(clinicFixture.veterinarianId);
startExamination(checkedIn, veterinarianId, clinicFixture.scheduledAt);

// @ts-expect-error AppointmentIdをVeterinarianIdとして使えません。
startExamination(checkedIn, scheduled.appointmentId, clinicFixture.scheduledAt);
