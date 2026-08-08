import { Link, useForm } from "@inertiajs/react";
import type { FormEvent } from "react";

import type { OwnerPageView } from "../../routes/ownerRoutes.js";
import type { SharedPageProps } from "../../pageProps.js";
import { ErrorSummary, FieldError } from "../../components/FormErrors.js";
import Layout from "../Layout.js";

type OwnerFormProps = SharedPageProps &
  Readonly<{
    mode: "create" | "edit";
    owner: OwnerPageView | null;
  }>;

export default function OwnerForm({ auth, errors, mode, owner }: OwnerFormProps) {
  const form = useForm({
    name: owner?.name ?? "",
    email: owner?.email ?? "",
    phone: owner?.phone ?? "",
  });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (mode === "create") {
      form.post("/owners", { forceFormData: true });
      return;
    }
    if (owner !== null) {
      form.post(`/owners/${owner.ownerId}`, { forceFormData: true });
    }
  };

  return (
    <Layout
      title={mode === "create" ? "飼い主を追加" : "飼い主の詳細・編集"}
      user={auth.user}
    >
      <ErrorSummary errors={errors} />
      <form onSubmit={submit}>
        <label>
          名前
          <input
            autoComplete="name"
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
          メールアドレス
          <input
            autoComplete="email"
            aria-describedby={errors.email === undefined ? undefined : "email-error"}
            aria-invalid={errors.email !== undefined}
            name="email"
            onChange={(event) => form.setData("email", event.target.value)}
            required
            type="email"
            value={form.data.email}
          />
        </label>
        <FieldError field="email" message={errors.email} />
        <label>
          電話番号
          <input
            autoComplete="tel"
            aria-describedby={errors.phone === undefined ? undefined : "phone-error"}
            aria-invalid={errors.phone !== undefined}
            name="phone"
            onChange={(event) => form.setData("phone", event.target.value)}
            required
            type="tel"
            value={form.data.phone}
          />
        </label>
        <FieldError field="phone" message={errors.phone} />
        <button disabled={form.processing} type="submit">
          {mode === "create" ? "追加" : "更新"}
        </button>
      </form>
      <p><Link href="/owners">飼い主一覧へ戻る</Link></p>
    </Layout>
  );
}
