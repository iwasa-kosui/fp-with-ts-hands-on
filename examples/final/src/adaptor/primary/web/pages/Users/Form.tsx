import { Link, useForm } from "@inertiajs/react";
import type { FormEvent } from "react";

import type { UserPageView } from "../../routes/userRoutes.js";
import type { SharedPageProps } from "../../pageProps.js";
import { ErrorSummary, FieldError } from "../../components/FormErrors.js";
import Layout from "../Layout.js";

type UserFormProps = SharedPageProps &
  Readonly<{
    mode: "create" | "edit";
    user: UserPageView | null;
  }>;

export default function UserForm({ auth, errors, mode, user }: UserFormProps) {
  const profile = useForm({
    email: user?.email ?? "",
    name: user?.name ?? "",
    password: "",
    role: user?.role ?? "Receptionist",
  });
  const password = useForm({ password: "" });
  const setRole = (value: string) => {
    switch (value) {
      case "Admin":
      case "Receptionist":
      case "Veterinarian":
        profile.setData("role", value);
        return;
    }
  };
  const submitProfile = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (mode === "create") {
      profile.post("/users", { forceFormData: true });
      return;
    }
    if (user !== null) {
      profile.post(`/users/${user.userId}`, { forceFormData: true });
    }
  };
  const submitPassword = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (user !== null) {
      password.post(`/users/${user.userId}/reset-password`, {
        forceFormData: true,
        onSuccess: () => password.reset("password"),
      });
    }
  };

  return (
    <Layout
      title={mode === "create" ? "ユーザーを追加" : "ユーザーを編集"}
      user={auth.user}
    >
      <ErrorSummary errors={errors} />
      <form onSubmit={submitProfile}>
        <label>
          名前
          <input
            autoComplete="name"
            aria-describedby={errors.name === undefined ? undefined : "name-error"}
            aria-invalid={errors.name !== undefined}
            name="name"
            onChange={(event) => profile.setData("name", event.target.value)}
            required
            type="text"
            value={profile.data.name}
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
            onChange={(event) => profile.setData("email", event.target.value)}
            required
            type="email"
            value={profile.data.email}
          />
        </label>
        <FieldError field="email" message={errors.email} />
        <label>
          役割
          <select
            aria-describedby={errors.role === undefined ? undefined : "role-error"}
            aria-invalid={errors.role !== undefined}
            name="role"
            onChange={(event) => setRole(event.target.value)}
            value={profile.data.role}
          >
            <option value="Admin">Admin</option>
            <option value="Receptionist">Receptionist</option>
            <option value="Veterinarian">Veterinarian</option>
          </select>
        </label>
        <FieldError field="role" message={errors.role} />
        {mode === "create" ? (
          <>
            <label>
              初期パスワード
              <input
                autoComplete="new-password"
                aria-describedby={errors.password === undefined ? undefined : "password-error"}
                aria-invalid={errors.password !== undefined}
                name="password"
                onChange={(event) =>
                  profile.setData("password", event.target.value)
                }
                required
                type="password"
                value={profile.data.password}
              />
            </label>
            <FieldError field="password" message={errors.password} />
          </>
        ) : null}
        <button disabled={profile.processing} type="submit">
          {mode === "create" ? "追加" : "更新"}
        </button>
      </form>
      {mode === "edit" ? (
        <section>
          <h2>パスワードを再設定</h2>
          <form onSubmit={submitPassword}>
            <label>
              新しいパスワード
              <input
                autoComplete="new-password"
                aria-describedby={errors.password === undefined ? undefined : "password-error"}
                aria-invalid={errors.password !== undefined}
                name="password"
                onChange={(event) =>
                  password.setData("password", event.target.value)
                }
                required
                type="password"
                value={password.data.password}
              />
            </label>
            <FieldError field="password" message={errors.password} />
            <button disabled={password.processing} type="submit">
              パスワードを再設定
            </button>
          </form>
        </section>
      ) : null}
      <p><Link href="/users">ユーザー一覧へ戻る</Link></p>
    </Layout>
  );
}
