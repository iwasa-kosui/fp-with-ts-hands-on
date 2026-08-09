import { Link, useForm } from "@inertiajs/react";
import type { FormEvent } from "react";

import type {
  PetOwnerOption,
  PetPageView,
} from "../../routes/petRoutes.js";
import type { SharedPageProps } from "../../pageProps.js";
import { ErrorSummary, FieldError } from "../../components/FormErrors.js";
import { buttonClassName } from "../../components/Button.js";
import { FormField } from "../../components/FormField.js";
import { Card } from "../../components/Surface.js";
import Layout from "../Layout.js";

type PetFormProps = SharedPageProps &
  Readonly<{
    mode: "create" | "edit";
    pet: PetPageView | null;
    owners: readonly PetOwnerOption[];
  }>;

export default function PetForm({ auth, errors, mode, owners, pet }: PetFormProps) {
  const form = useForm({
    ownerId: pet?.ownerId ?? owners[0]?.ownerId ?? "",
    name: pet?.name ?? "",
    species: pet?.species ?? "",
  });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (mode === "create") {
      form.post("/pets", { forceFormData: true });
      return;
    }
    if (pet !== null) {
      form.post(`/pets/${pet.petId}`, { forceFormData: true });
    }
  };

  return (
    <Layout activeNavigation="pets" title={mode === "create" ? "ペットを追加" : "ペットの詳細・編集"} user={auth.user}>
      <ErrorSummary errors={errors} />
      <Card className="management-form-card">
        <form aria-label={mode === "create" ? "ペット作成" : "ペット編集"} className="form-stack" onSubmit={submit}>
          {mode === "create" ? (
            <FormField {...(errors.ownerId === undefined ? {} : { error: errors.ownerId })} field="ownerId" label="飼い主">
            <select
              aria-describedby={errors.ownerId === undefined ? undefined : "ownerId-error"}
              aria-invalid={errors.ownerId === undefined ? undefined : true}
              id="ownerId"
              name="ownerId"
              onChange={(event) => form.setData("ownerId", event.target.value)}
              required
              value={form.data.ownerId}
            >
              {owners.length === 0 ? (
                <option value="">先に飼い主を登録してください</option>
              ) : null}
              {owners.map((owner) => (
                <option key={owner.ownerId} value={owner.ownerId}>
                  {owner.name}
                </option>
                ))}
            </select>
            </FormField>
          ) : (
            <dl className="metadata-list">
              <div>
                <dt>飼い主 ID</dt>
                <dd>{pet?.ownerId}</dd>
              </div>
            </dl>
          )}
          {mode === "edit" ? <FieldError field="ownerId" message={errors.ownerId} /> : null}
          <FormField {...(errors.name === undefined ? {} : { error: errors.name })} field="name" label="名前">
          <input
            aria-describedby={errors.name === undefined ? undefined : "name-error"}
            aria-invalid={errors.name === undefined ? undefined : true}
            id="name"
            name="name"
            onChange={(event) => form.setData("name", event.target.value)}
            required
            type="text"
            value={form.data.name}
          />
          </FormField>
          <FormField {...(errors.species === undefined ? {} : { error: errors.species })} field="species" label="種別">
          <input
            aria-describedby={errors.species === undefined ? undefined : "species-error"}
            aria-invalid={errors.species === undefined ? undefined : true}
            id="species"
            name="species"
            onChange={(event) => form.setData("species", event.target.value)}
            required
            type="text"
            value={form.data.species}
          />
          </FormField>
          <div className="form-actions">
            <Link className={buttonClassName("secondary")} href="/pets">ペット一覧へ戻る</Link>
            <button
              aria-busy={form.processing || undefined}
              className={buttonClassName()}
              disabled={form.processing || (mode === "create" && owners.length === 0)}
              type="submit"
            >
              {mode === "create" ? "追加" : "更新"}
            </button>
          </div>
        </form>
      </Card>
    </Layout>
  );
}
