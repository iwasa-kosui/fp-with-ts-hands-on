// @ts-nocheck
import type { Scheduled } from "../../src/domain/appointment/appointment.js";
import {
  checkIn,
  startExamination,
} from "../../src/domain/appointment/transitions.js";
import { AppointmentId } from "../../src/domain/ids/appointmentId.js";
import { OwnerId } from "../../src/domain/ids/ownerId.js";
import { PetId } from "../../src/domain/ids/petId.js";
import { VeterinarianId } from "../../src/domain/ids/veterinarianId.js";
import { clinicFixture } from "../../../fixtures/clinic.js";

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
