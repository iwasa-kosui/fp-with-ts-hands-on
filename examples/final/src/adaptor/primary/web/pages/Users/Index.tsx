import { Link, useForm } from "@inertiajs/react";

import type { UserPageView } from "../../routes/userRoutes.js";
import type { SharedPageProps } from "../../pageProps.js";
import { buttonClassName } from "@fp-with-ts/clinic-web";
import { DataTable } from "@fp-with-ts/clinic-web";
import { ErrorSummary } from "@fp-with-ts/clinic-web";
import { EmptyState, InlineAlert } from "@fp-with-ts/clinic-web";
import Layout from "../Layout.js";

type UsersIndexProps = SharedPageProps &
  Readonly<{ users: readonly UserPageView[] }>;

export default function UsersIndex({ auth, errors, users }: UsersIndexProps) {
  const deletion = useForm({});
  const remove = (user: UserPageView) => {
    if (
      window.confirm(
        `${user.name} のアカウントのプロジェクションを物理削除しますか？監査履歴は保持され、個人情報の完全消去ではありません。`,
      )
    ) {
      deletion.post(`/users/${user.userId}/delete`, { forceFormData: true });
    }
  };

  return (
    <Layout
      actions={
        <Link className={buttonClassName()} href="/users/new">
          ユーザーを追加
        </Link>
      }
      activeNavigation="users"
      title="ユーザー管理"
      user={auth.user}
    >
      <ErrorSummary errors={errors} />
      <InlineAlert>
        削除するとアカウントのプロジェクションを物理削除します。監査履歴は保持されます。個人情報の完全消去ではありません。
      </InlineAlert>
      {users.length === 0 ? (
        <EmptyState>ユーザーはいません。</EmptyState>
      ) : (
        <DataTable label="ユーザー一覧">
          <thead>
            <tr><th scope="col">名前</th><th scope="col">メール</th><th scope="col">役割</th><th scope="col">操作</th></tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.userId}>
                <td>{user.name}</td>
                <td>{user.email}</td>
                <td>{user.role}</td>
                <td>
                  <div className="table-actions">
                    <Link className={buttonClassName("secondary")} href={`/users/${user.userId}/edit`}>編集</Link>
                    <button
                      className={buttonClassName("danger")}
                      disabled={
                        deletion.processing || auth.user?.userId === user.userId
                      }
                      onClick={() => remove(user)}
                      type="button"
                    >
                      削除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      )}
    </Layout>
  );
}
