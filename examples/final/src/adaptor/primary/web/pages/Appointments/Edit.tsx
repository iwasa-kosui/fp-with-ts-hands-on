import { AppointmentForm, toLocalAppointmentDateTime, type AppointmentOwnerOption, type AppointmentPetOption, type AppointmentVeterinarianOption } from "../../components/AppointmentForm.js";
import { ErrorSummary } from "../../components/FormErrors.js";
import { Card } from "../../components/Surface.js";
import type { SharedPageProps } from "../../pageProps.js";
import Layout from "../Layout.js";
type EditableAppointment = Readonly<{ appointmentId: string; ownerId: string; petId: string; scheduledAt: string; durationMinutes: number; serviceCode: "GeneralConsultation" | "FollowUpVisit" | "Vaccination" | "ExaminationOrProcedure"; assignedVeterinarianId: string | null; visitReason: string; version: number; immutablePetAndService: boolean }>;
type Props = SharedPageProps & Readonly<{ appointment: EditableAppointment; owners: readonly AppointmentOwnerOption[]; pets: readonly AppointmentPetOption[]; veterinarians: readonly AppointmentVeterinarianOption[] }>;
export default function AppointmentEdit({ appointment, auth, errors, owners, pets, veterinarians }: Props) {
  return <Layout activeNavigation="appointments" title="予約変更" user={auth.user}>
    <ErrorSummary errors={errors} />
    <Card><AppointmentForm action={`/appointments/${appointment.appointmentId}`} backHref={`/appointments/${appointment.appointmentId}`} errors={errors} initialValues={{ ownerId: appointment.ownerId, petId: appointment.petId, scheduledAt: toLocalAppointmentDateTime(appointment.scheduledAt) ?? "", durationMinutes: String(appointment.durationMinutes), serviceCode: appointment.serviceCode, assignedVeterinarianId: appointment.assignedVeterinarianId ?? "", reason: appointment.visitReason, expectedVersion: String(appointment.version) }} immutablePetAndService={appointment.immutablePetAndService} method="put" mode="Reserved" owners={owners} pets={pets} submitLabel="予約を変更" veterinarians={veterinarians} /></Card>
  </Layout>;
}
