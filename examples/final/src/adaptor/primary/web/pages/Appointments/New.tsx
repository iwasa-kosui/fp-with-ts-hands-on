import { Link, useForm } from "@inertiajs/react";

import { buttonClassName } from "../../components/Button.js";
import { ErrorSummary } from "../../components/FormErrors.js";
import { FormField } from "../../components/FormField.js";
import { Card } from "../../components/Surface.js";
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

export const toAppointmentTimestamp = (localDateTime: string): string => {
  if (localDateTime === "") return "";
  const timestamp = new Date(localDateTime);
  return Number.isNaN(timestamp.valueOf())
    ? localDateTime
    : timestamp.toISOString();
};

export default function AppointmentNew({ auth, errors, owners, pets }: Props) {
  const form = useForm({ ownerId: "", petId: "", scheduledAt: "", reason: "" });
  const availablePets = pets.filter((pet) => pet.ownerId === form.data.ownerId);
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    form.transform((data) => ({
      ...data,
      scheduledAt: toAppointmentTimestamp(data.scheduledAt),
    }));
    form.post("/appointments", { forceFormData: true });
  };

  return (
    <Layout activeNavigation="appointments" title="予約登録" user={auth.user}>
      <ErrorSummary errors={errors} />
      <Card className="appointment-booking-card">
        <form aria-label="予約登録" className="form-stack" onSubmit={submit}>
          <div className="form-grid">
            <FormField
              {...(errors.ownerId === undefined ? {} : { error: errors.ownerId })}
              field="ownerId"
              label="飼い主"
            >
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
            </FormField>

            <FormField
              {...(errors.petId === undefined ? {} : { error: errors.petId })}
              field="petId"
              label="ペット"
            >
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
            </FormField>
          </div>

          <FormField
            {...(errors.scheduledAt === undefined ? {} : { error: errors.scheduledAt })}
            field="scheduledAt"
            label="予約日時"
          >
            <input
              aria-describedby={errors.scheduledAt === undefined ? undefined : "scheduledAt-error"}
              aria-invalid={errors.scheduledAt === undefined ? undefined : true}
              id="scheduledAt"
              name="scheduledAt"
              onChange={(event) => form.setData("scheduledAt", event.target.value)}
              step="60"
              type="datetime-local"
              value={form.data.scheduledAt}
            />
          </FormField>

          <FormField
            {...(errors.reason === undefined ? {} : { error: errors.reason })}
            field="reason"
            label="来院理由"
          >
            <textarea
              aria-describedby={errors.reason === undefined ? undefined : "reason-error"}
              aria-invalid={errors.reason === undefined ? undefined : true}
              id="reason"
              name="reason"
              onChange={(event) => form.setData("reason", event.target.value)}
              value={form.data.reason}
            />
          </FormField>
          <div className="form-actions">
            <Link className={buttonClassName("secondary")} href="/appointments">
              一覧へ戻る
            </Link>
            <button
              aria-busy={form.processing || undefined}
              className={buttonClassName()}
              disabled={form.processing}
              type="submit"
            >
              {form.processing ? "登録中…" : "予約を登録"}
            </button>
          </div>
        </form>
      </Card>
    </Layout>
  );
}
