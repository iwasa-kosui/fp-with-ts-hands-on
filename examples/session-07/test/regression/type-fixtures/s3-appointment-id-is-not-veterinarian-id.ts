// @ts-nocheck
import { AppointmentId } from "../../../src/domain/ids/appointmentId.js";
import { VeterinarianId } from "../../../src/domain/ids/veterinarianId.js";
import { clinicFixture } from "../../../../fixtures/clinic.js";

const appointmentId = AppointmentId.parse(clinicFixture.appointmentId);
const veterinarianId = VeterinarianId.parse(clinicFixture.veterinarianId);
const acceptAppointmentId = (_id: AppointmentId): void => undefined;
const acceptVeterinarianId = (_id: VeterinarianId): void => undefined;

// @ts-expect-error VeterinarianIdをAppointmentIdとして使えません。
acceptAppointmentId(veterinarianId);

// @ts-expect-error AppointmentIdをVeterinarianIdとして使えません。
acceptVeterinarianId(appointmentId);
