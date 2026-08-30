// @ts-nocheck
import { AppointmentId } from "../../../src/domain/appointment/index.js";
import { VeterinarianId } from "../../../src/domain/appointment/index.js";
import { clinicFixture } from "../../../../fixtures/clinic.js";

const appointmentId = AppointmentId.parse(clinicFixture.appointmentId);
const veterinarianId = VeterinarianId.parse(clinicFixture.veterinarianId);
const acceptAppointmentId = (_id: AppointmentId): void => undefined;
const acceptVeterinarianId = (_id: VeterinarianId): void => undefined;

// @ts-expect-error VeterinarianIdをAppointmentIdとして使えません。
acceptAppointmentId(veterinarianId);

// @ts-expect-error AppointmentIdをVeterinarianIdとして使えません。
acceptVeterinarianId(appointmentId);
