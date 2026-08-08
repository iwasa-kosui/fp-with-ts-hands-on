import { Link, useForm } from "@inertiajs/react";
import type { FormEvent } from "react";

import type {
  PetOwnerOption,
  PetPageView,
} from "../../routes/petRoutes.js";
import type { SharedPageProps } from "../../pageProps.js";
import { ErrorSummary, FieldError } from "../../components/FormErrors.js";
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
    <Layout
      title={mode === "create" ? "ペットを追加" : "ペットの詳細・編集"}
      user={auth.user}
    >
      <ErrorSummary errors={errors} />
      <form onSubmit={submit}>
        {mode === "create" ? (
          <label>
            飼い主
            <select
              aria-describedby={errors.ownerId === undefined ? undefined : "ownerId-error"}
              aria-invalid={errors.ownerId !== undefined}
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
          </label>
        ) : (
          <p>飼い主 ID: {pet?.ownerId}</p>
        )}
        <FieldError field="ownerId" message={errors.ownerId} />
        <label>
          名前
          <input
            aria-describedby={errors.name === undefined ? undefined : "name-error"}
            aria-invalid={errors.name !== undefined}
            name="name"
            onChange={(event) => form.setData("name", event.target.value)}
            required
            type="text"
            value={form.data.name}
          />
        </label>
        <FieldError field="name" message={errors.name} />
        <label>
          種別
          <input
            aria-describedby={errors.species === undefined ? undefined : "species-error"}
            aria-invalid={errors.species !== undefined}
            name="species"
            onChange={(event) => form.setData("species", event.target.value)}
            required
            type="text"
            value={form.data.species}
          />
        </label>
        <FieldError field="species" message={errors.species} />
        <button disabled={form.processing || (mode === "create" && owners.length === 0)} type="submit">
          {mode === "create" ? "追加" : "更新"}
        </button>
      </form>
      <p><Link href="/pets">ペット一覧へ戻る</Link></p>
    </Layout>
  );
}
