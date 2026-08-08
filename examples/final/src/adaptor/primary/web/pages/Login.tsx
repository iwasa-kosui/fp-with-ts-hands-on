import { useForm } from "@inertiajs/react";
import type { FormEvent } from "react";

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
      <form onSubmit={submit}>
        <label>
          メールアドレス
          <input
            autoComplete="email"
            name="email"
            onChange={(event) => form.setData("email", event.target.value)}
            type="email"
            value={form.data.email}
          />
        </label>
        <label>
          パスワード
          <input
            autoComplete="current-password"
            name="password"
            onChange={(event) => form.setData("password", event.target.value)}
            type="password"
            value={form.data.password}
          />
        </label>
        {errors.credentials === undefined ? null : (
          <p className="error">{errors.credentials}</p>
        )}
        {errors.email === undefined ? null : <p className="error">{errors.email}</p>}
        {errors.password === undefined ? null : <p className="error">{errors.password}</p>}
        <button disabled={form.processing} type="submit">
          ログイン
        </button>
      </form>
    </Layout>
  );
}
