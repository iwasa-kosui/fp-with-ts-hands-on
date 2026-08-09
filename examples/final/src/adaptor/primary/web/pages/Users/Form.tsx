import { Link, useForm } from "@inertiajs/react";
import type { FormEvent } from "react";

import type { UserPageView } from "../../routes/userRoutes.js";
import type { SharedPageProps } from "../../pageProps.js";
import { buttonClassName } from "../../components/Button.js";
import { ErrorSummary } from "../../components/FormErrors.js";
import { FormField } from "../../components/FormField.js";
import { Card } from "../../components/Surface.js";
import { rolePresentation } from "../../components/rolePresentation.js";
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

  const profileFields = (
    <>
      <FormField {...(errors.name === undefined ? {} : { error: errors.name })} field="name" label="名前">
        <input
          autoComplete="name"
          aria-describedby={errors.name === undefined ? undefined : "name-error"}
          aria-invalid={errors.name === undefined ? undefined : true}
          id="name"
          name="name"
          onChange={(event) => profile.setData("name", event.target.value)}
          required
          type="text"
          value={profile.data.name}
        />
      </FormField>
      <FormField {...(errors.email === undefined ? {} : { error: errors.email })} field="email" label="メールアドレス">
        <input
          autoComplete="email"
          aria-describedby={errors.email === undefined ? undefined : "email-error"}
          aria-invalid={errors.email === undefined ? undefined : true}
          id="email"
          name="email"
          onChange={(event) => profile.setData("email", event.target.value)}
          required
          type="email"
          value={profile.data.email}
        />
      </FormField>
      <FormField {...(errors.role === undefined ? {} : { error: errors.role })} field="role" label="役割">
        <select
          aria-describedby={errors.role === undefined ? undefined : "role-error"}
          aria-invalid={errors.role === undefined ? undefined : true}
          id="role"
          name="role"
          onChange={(event) => setRole(event.target.value)}
          value={profile.data.role}
        >
          <option value="Admin">{rolePresentation("Admin")}</option>
          <option value="Receptionist">{rolePresentation("Receptionist")}</option>
          <option value="Veterinarian">{rolePresentation("Veterinarian")}</option>
        </select>
      </FormField>
    </>
  );

  const profileForm = (
    <form
      aria-label={mode === "create" ? "ユーザー作成" : "プロフィール"}
      className="form-stack"
      onSubmit={submitProfile}
    >
      {profileFields}
      {mode === "create" ? (
        <FormField {...(errors.password === undefined ? {} : { error: errors.password })} field="password" label="初期パスワード">
          <input
            autoComplete="new-password"
            aria-describedby={errors.password === undefined ? undefined : "password-error"}
            aria-invalid={errors.password === undefined ? undefined : true}
            id="password"
            name="password"
            onChange={(event) => profile.setData("password", event.target.value)}
            required
            type="password"
            value={profile.data.password}
          />
        </FormField>
      ) : null}
      <div className="form-actions">
        <Link className={buttonClassName("secondary")} href="/users">ユーザー一覧へ戻る</Link>
        <button aria-busy={profile.processing || undefined} className={buttonClassName()} disabled={profile.processing} type="submit">
          {mode === "create" ? "追加" : "更新"}
        </button>
      </div>
    </form>
  );

  return (
    <Layout activeNavigation="users" title={mode === "create" ? "ユーザーを追加" : "ユーザーを編集"} user={auth.user}>
      <ErrorSummary errors={errors} />
      {mode === "create" ? (
        <Card className="management-form-card">{profileForm}</Card>
      ) : (
        <div className="settings-grid">
          <section aria-label="プロフィール">
            <Card className="management-form-card">
              <h2>プロフィール</h2>
              {profileForm}
            </Card>
          </section>
          <section aria-label="パスワードを再設定">
            <Card className="management-form-card">
              <h2>パスワードを再設定</h2>
              <form aria-label="パスワードを再設定" className="form-stack" onSubmit={submitPassword}>
                <FormField {...(errors.password === undefined ? {} : { error: errors.password })} field="password" label="新しいパスワード">
                  <input
                    autoComplete="new-password"
                    aria-describedby={errors.password === undefined ? undefined : "password-error"}
                    aria-invalid={errors.password === undefined ? undefined : true}
                    id="password"
                    name="password"
                    onChange={(event) => password.setData("password", event.target.value)}
                    required
                    type="password"
                    value={password.data.password}
                  />
                </FormField>
                <div className="form-actions">
                  <button aria-busy={password.processing || undefined} className={buttonClassName()} disabled={password.processing} type="submit">
                    パスワードを再設定
                  </button>
                </div>
              </form>
            </Card>
          </section>
        </div>
      )}
    </Layout>
  );
}
