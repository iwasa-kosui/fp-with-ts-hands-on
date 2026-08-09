import { AppointmentForm, type AppointmentOwnerOption, type AppointmentPetOption, type AppointmentVeterinarianOption } from "../../components/AppointmentForm.js";
import { ErrorSummary } from "../../components/FormErrors.js";
import { Card } from "../../components/Surface.js";
import type { SharedPageProps } from "../../pageProps.js";
import Layout from "../Layout.js";
type Props = SharedPageProps & Readonly<{ owners: readonly AppointmentOwnerOption[]; pets: readonly AppointmentPetOption[]; veterinarians: readonly AppointmentVeterinarianOption[] }>;
export default function WalkInNew({ auth, errors, owners, pets, veterinarians }: Props) {
  return <Layout activeNavigation="appointments" title="飛び込み受付" user={auth.user}>
    <ErrorSummary errors={errors} />
    <Card><AppointmentForm action="/reception/walk-ins" backHref="/appointments" errors={errors} method="post" mode="WalkIn" owners={owners} pets={pets} submitLabel="飛び込みを受付" veterinarians={veterinarians} /></Card>
  </Layout>;
}
