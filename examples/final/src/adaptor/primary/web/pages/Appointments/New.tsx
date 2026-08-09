import { AppointmentForm, toAppointmentTimestamp, type AppointmentOwnerOption, type AppointmentPetOption, type AppointmentVeterinarianOption } from "../../components/AppointmentForm.js";
import { ErrorSummary } from "../../components/FormErrors.js";
import { Card } from "../../components/Surface.js";
import type { SharedPageProps } from "../../pageProps.js";
import Layout from "../Layout.js";
export { toAppointmentTimestamp };
type Props = SharedPageProps & Readonly<{ owners: readonly AppointmentOwnerOption[]; pets: readonly AppointmentPetOption[]; veterinarians?: readonly AppointmentVeterinarianOption[] }>;
export default function AppointmentNew({ auth, errors, owners, pets, veterinarians = [] }: Props) {
  return <Layout activeNavigation="appointments" title="予約登録" user={auth.user}>
    <ErrorSummary errors={errors} />
    <Card className="appointment-booking-card"><AppointmentForm action="/appointments" ariaLabel="予約登録" backHref="/appointments" errors={errors} method="post" mode="Reserved" owners={owners} pets={pets} submitLabel="予約を登録" veterinarians={veterinarians} /></Card>
  </Layout>;
}
