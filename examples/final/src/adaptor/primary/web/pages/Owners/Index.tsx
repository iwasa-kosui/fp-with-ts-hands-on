import { Link, useForm } from "@inertiajs/react";

import type { OwnerPageView } from "../../routes/ownerRoutes.js";
import type { SharedPageProps } from "../../pageProps.js";
import Layout from "../Layout.js";

type OwnersIndexProps = SharedPageProps &
  Readonly<{ owners: readonly OwnerPageView[] }>;

export default function OwnersIndex({ auth, owners }: OwnersIndexProps) {
  const deletion = useForm({});
  const remove = (owner: OwnerPageView) => {
    if (
      window.confirm(
        `${owner.name} を削除しますか？関連する監査履歴は保持されます。`,
      )
    ) {
      deletion.post(`/owners/${owner.ownerId}/delete`, { forceFormData: true });
    }
  };

  return (
    <Layout title="飼い主管理" user={auth.user}>
      <p><Link href="/owners/new">飼い主を追加</Link></p>
      <p className="notice">
        削除後も監査履歴は保持されます。個人情報の完全消去ではありません。
      </p>
      {owners.length === 0 ? (
        <p>飼い主はいません。</p>
      ) : (
        <table>
          <thead>
            <tr><th scope="col">名前</th><th scope="col">メール</th><th scope="col">電話</th><th scope="col">操作</th></tr>
          </thead>
          <tbody>
            {owners.map((owner) => (
              <tr key={owner.ownerId}>
                <td><Link href={`/owners/${owner.ownerId}`}>{owner.name}</Link></td>
                <td>{owner.email}</td>
                <td>{owner.phone}</td>
                <td>
                  <button
                    disabled={deletion.processing}
                    onClick={() => remove(owner)}
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
