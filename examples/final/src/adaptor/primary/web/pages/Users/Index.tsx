import { Link, useForm } from "@inertiajs/react";

import type { UserPageView } from "../../routes/userRoutes.js";
import type { SharedPageProps } from "../../pageProps.js";
import Layout from "../Layout.js";

type UsersIndexProps = SharedPageProps &
  Readonly<{ users: readonly UserPageView[] }>;

export default function UsersIndex({ auth, users }: UsersIndexProps) {
  const deletion = useForm({});
  const remove = (user: UserPageView) => {
    if (
      window.confirm(
        `${user.name} を削除しますか？この操作は元に戻せません。`,
      )
    ) {
      deletion.post(`/users/${user.userId}/delete`, { forceFormData: true });
    }
  };

  return (
    <Layout title="ユーザー管理" user={auth.user}>
      <p><Link href="/users/new">ユーザーを追加</Link></p>
      {users.length === 0 ? (
        <p>ユーザーはいません。</p>
      ) : (
        <table>
          <thead>
            <tr><th scope="col">名前</th><th scope="col">メール</th><th scope="col">役割</th><th scope="col">操作</th></tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.userId}>
                <td>{user.name}</td>
                <td>{user.email}</td>
                <td>{user.role}</td>
                <td className="actions">
                  <Link href={`/users/${user.userId}/edit`}>編集</Link>
                  <button
                    disabled={
                      deletion.processing || auth.user?.userId === user.userId
                    }
                    onClick={() => remove(user)}
                    type="button"
                  >
                    削除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Layout>
  );
}
