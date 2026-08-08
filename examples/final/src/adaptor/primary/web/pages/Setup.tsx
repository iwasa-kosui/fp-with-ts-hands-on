import { useForm } from "@inertiajs/react";
import type { FormEvent } from "react";

import type { SharedPageProps } from "../pageProps.js";
import Layout from "./Layout.js";

export default function Setup({ errors }: SharedPageProps) {
  const form = useForm({ email: "", name: "", password: "" });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    form.post("/setup");
  };

  return (
    <Layout title="最初の管理者を登録">
      <p>最初の一人だけが、この画面から管理者を登録できます。</p>
      <form onSubmit={submit}>
        <label>
          表示名
          <input
            autoComplete="name"
            name="name"
            onChange={(event) => form.setData("name", event.target.value)}
            value={form.data.name}
          />
        </label>
        {errors.name === undefined ? null : <p className="error">{errors.name}</p>}
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
        {errors.email === undefined ? null : <p className="error">{errors.email}</p>}
        <label>
          パスワード
          <input
            autoComplete="new-password"
            name="password"
            onChange={(event) => form.setData("password", event.target.value)}
            type="password"
            value={form.data.password}
          />
        </label>
        {errors.password === undefined ? null : <p className="error">{errors.password}</p>}
        <button disabled={form.processing} type="submit">
          管理者を登録
        </button>
      </form>
    </Layout>
  );
}
