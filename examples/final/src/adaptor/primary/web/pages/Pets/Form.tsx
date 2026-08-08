import { Link, useForm } from "@inertiajs/react";
import type { FormEvent } from "react";

import type {
  PetOwnerOption,
  PetPageView,
} from "../../routes/petRoutes.js";
import type { SharedPageProps } from "../../pageProps.js";
import Layout from "../Layout.js";

type PetFormProps = SharedPageProps &
  Readonly<{
    mode: "create" | "edit";
    pet: PetPageView | null;
    owners: readonly PetOwnerOption[];
  }>;

const ErrorMessage = ({ message }: Readonly<{ message: string | undefined }>) =>
  message === undefined ? null : <p className="error">{message}</p>;

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
      <form onSubmit={submit}>
        {mode === "create" ? (
          <label>
            飼い主
            <select
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
        <ErrorMessage message={errors.ownerId} />
        <label>
          名前
          <input
            name="name"
            onChange={(event) => form.setData("name", event.target.value)}
            required
            type="text"
            value={form.data.name}
          />
        </label>
        <ErrorMessage message={errors.name} />
        <label>
          種別
          <input
            name="species"
            onChange={(event) => form.setData("species", event.target.value)}
            required
            type="text"
            value={form.data.species}
          />
        </label>
        <ErrorMessage message={errors.species} />
        <button disabled={form.processing || (mode === "create" && owners.length === 0)} type="submit">
          {mode === "create" ? "追加" : "更新"}
        </button>
      </form>
      <p><Link href="/pets">ペット一覧へ戻る</Link></p>
    </Layout>
  );
}
