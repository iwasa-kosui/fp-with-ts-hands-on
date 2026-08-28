import { Link, useForm } from "@inertiajs/react";
import type { FormEvent } from "react";

import type { OwnerPageView } from "../../routes/ownerRoutes.js";
import type { SharedPageProps } from "../../pageProps.js";
import { buttonClassName } from "@fp-with-ts/clinic-web";
import { ErrorSummary } from "@fp-with-ts/clinic-web";
import { FormField } from "@fp-with-ts/clinic-web";
import { Card } from "@fp-with-ts/clinic-web";
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
    <Layout activeNavigation="owners" title={mode === "create" ? "飼い主を追加" : "飼い主の詳細・編集"} user={auth.user}>
      <ErrorSummary errors={errors} />
      <Card className="management-form-card">
        <form aria-label={mode === "create" ? "飼い主作成" : "飼い主編集"} className="form-stack" onSubmit={submit}>
          <FormField {...(errors.name === undefined ? {} : { error: errors.name })} field="name" label="名前">
          <input
            autoComplete="name"
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
          <FormField {...(errors.email === undefined ? {} : { error: errors.email })} field="email" label="メールアドレス">
          <input
            autoComplete="email"
            aria-describedby={errors.email === undefined ? undefined : "email-error"}
            aria-invalid={errors.email === undefined ? undefined : true}
            id="email"
            name="email"
            onChange={(event) => form.setData("email", event.target.value)}
            required
            type="email"
            value={form.data.email}
          />
          </FormField>
          <FormField {...(errors.phone === undefined ? {} : { error: errors.phone })} field="phone" label="電話番号">
          <input
            autoComplete="tel"
            aria-describedby={errors.phone === undefined ? undefined : "phone-error"}
            aria-invalid={errors.phone === undefined ? undefined : true}
            id="phone"
            name="phone"
            onChange={(event) => form.setData("phone", event.target.value)}
            required
            type="tel"
            value={form.data.phone}
          />
          </FormField>
          <div className="form-actions">
            <Link className={buttonClassName("secondary")} href="/owners">飼い主一覧へ戻る</Link>
            <button aria-busy={form.processing || undefined} className={buttonClassName()} disabled={form.processing} type="submit">
              {mode === "create" ? "追加" : "更新"}
            </button>
          </div>
        </form>
      </Card>
    </Layout>
  );
}
