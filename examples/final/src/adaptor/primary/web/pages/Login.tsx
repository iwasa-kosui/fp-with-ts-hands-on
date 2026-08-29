import { useForm } from "@inertiajs/react";
import type { FormEvent } from "react";

import { buttonClassName } from "@fp-with-ts/clinic-web";
import { ErrorSummary } from "@fp-with-ts/clinic-web";
import { FormField } from "@fp-with-ts/clinic-web";
import type { SharedPageProps } from "../pageProps.js";
import Layout from "./Layout.js";

export default function Login({ errors }: SharedPageProps) {
  const form = useForm({ email: "", password: "" });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    form.post("/login");
  };

  return (
    <Layout title="ログイン">
      <section className="auth-shell">
        <div className="auth-card">
          <p className="auth-card__brand">関数型どうぶつ病院</p>
          <form aria-label="ログイン" className="form-stack" onSubmit={submit}>
            <ErrorSummary errors={errors} />
            <FormField
              {...(errors.email === undefined ? {} : { error: errors.email })}
              field="email"
              label="メールアドレス"
            >
              <input
                aria-describedby={errors.email === undefined ? undefined : "email-error"}
                aria-invalid={errors.email !== undefined}
                autoComplete="email"
                id="email"
                name="email"
                onChange={(event) => form.setData("email", event.target.value)}
                type="email"
                value={form.data.email}
              />
            </FormField>
            <FormField
              {...(errors.password === undefined ? {} : { error: errors.password })}
              field="password"
              label="パスワード"
            >
              <input
                aria-describedby={errors.password === undefined ? undefined : "password-error"}
                aria-invalid={errors.password !== undefined}
                autoComplete="current-password"
                id="password"
                name="password"
                onChange={(event) => form.setData("password", event.target.value)}
                type="password"
                value={form.data.password}
              />
            </FormField>
            <button
              aria-busy={form.processing || undefined}
              className={buttonClassName()}
              disabled={form.processing}
              type="submit"
            >
              ログイン
            </button>
          </form>
        </div>
      </section>
    </Layout>
  );
}
