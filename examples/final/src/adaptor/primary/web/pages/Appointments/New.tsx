import { useForm } from "@inertiajs/react";

import { ErrorSummary, FieldError } from "../../components/FormErrors.js";
import type { SharedPageProps } from "../../pageProps.js";
import type {
  AppointmentOwnerOption,
  AppointmentPetOption,
} from "../../routes/appointmentRoutes.js";
import Layout from "../Layout.js";

type Props = SharedPageProps &
  Readonly<{
    owners: readonly AppointmentOwnerOption[];
    pets: readonly AppointmentPetOption[];
  }>;

export default function AppointmentNew({ auth, errors, owners, pets }: Props) {
  const form = useForm({ ownerId: "", petId: "", scheduledAt: "", reason: "" });
  const availablePets = pets.filter((pet) => pet.ownerId === form.data.ownerId);
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    form.post("/appointments", { forceFormData: true });
  };

  return (
    <Layout title="予約登録" user={auth.user}>
      <ErrorSummary errors={errors} />
      <form onSubmit={submit}>
        <label htmlFor="ownerId">
          飼い主
          <select
            aria-describedby={errors.ownerId === undefined ? undefined : "ownerId-error"}
            aria-invalid={errors.ownerId === undefined ? undefined : true}
            id="ownerId"
            name="ownerId"
            onChange={(event) => {
              form.setData("ownerId", event.target.value);
              form.setData("petId", "");
            }}
            value={form.data.ownerId}
          >
            <option value="">選択してください</option>
            {owners.map((owner) => (
              <option key={owner.ownerId} value={owner.ownerId}>{owner.name}</option>
            ))}
          </select>
        </label>
        <FieldError field="ownerId" message={errors.ownerId} />

        <label htmlFor="petId">
          ペット
          <select
            aria-describedby={errors.petId === undefined ? undefined : "petId-error"}
            aria-invalid={errors.petId === undefined ? undefined : true}
            disabled={form.data.ownerId === ""}
            id="petId"
            name="petId"
            onChange={(event) => form.setData("petId", event.target.value)}
            value={form.data.petId}
          >
            <option value="">選択してください</option>
            {availablePets.map((pet) => (
              <option key={pet.petId} value={pet.petId}>{pet.name}</option>
            ))}
          </select>
        </label>
        <FieldError field="petId" message={errors.petId} />

        <label htmlFor="scheduledAt">
          予約日時（ISO 8601）
          <input
            aria-describedby={errors.scheduledAt === undefined ? undefined : "scheduledAt-error"}
            aria-invalid={errors.scheduledAt === undefined ? undefined : true}
            id="scheduledAt"
            name="scheduledAt"
            onChange={(event) => form.setData("scheduledAt", event.target.value)}
            placeholder="2026-08-10T03:00:00.000Z"
            type="text"
            value={form.data.scheduledAt}
          />
        </label>
        <FieldError field="scheduledAt" message={errors.scheduledAt} />

        <label htmlFor="reason">
          来院理由
          <textarea
            aria-describedby={errors.reason === undefined ? undefined : "reason-error"}
            aria-invalid={errors.reason === undefined ? undefined : true}
            id="reason"
            name="reason"
            onChange={(event) => form.setData("reason", event.target.value)}
            value={form.data.reason}
          />
        </label>
        <FieldError field="reason" message={errors.reason} />
        <button disabled={form.processing} type="submit">
          {form.processing ? "登録中…" : "予約を登録"}
        </button>
      </form>
    </Layout>
  );
}
