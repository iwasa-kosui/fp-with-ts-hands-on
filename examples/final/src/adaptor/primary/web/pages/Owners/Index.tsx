import { Link, useForm } from "@inertiajs/react";

import type { OwnerPageView } from "../../routes/ownerRoutes.js";
import type { SharedPageProps } from "../../pageProps.js";
import { buttonClassName } from "@fp-with-ts/clinic-web";
import { DataTable } from "@fp-with-ts/clinic-web";
import { ErrorSummary } from "@fp-with-ts/clinic-web";
import { EmptyState, InlineAlert } from "@fp-with-ts/clinic-web";
import Layout from "../Layout.js";

type OwnersIndexProps = SharedPageProps &
  Readonly<{ owners: readonly OwnerPageView[] }>;

export default function OwnersIndex({ auth, errors, owners }: OwnersIndexProps) {
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
    <Layout
      actions={
        <Link className={buttonClassName()} href="/owners/new">
          飼い主を追加
        </Link>
      }
      activeNavigation="owners"
      title="飼い主管理"
      user={auth.user}
    >
      <ErrorSummary errors={errors} />
      <InlineAlert>
        削除後も監査履歴は保持されます。個人情報の完全消去ではありません。
      </InlineAlert>
      {owners.length === 0 ? (
        <EmptyState>飼い主はいません。</EmptyState>
      ) : (
        <DataTable label="飼い主一覧">
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
                  <div className="table-actions">
                    <Link className={buttonClassName("secondary")} href={`/owners/${owner.ownerId}`}>編集</Link>
                    <button
                      className={buttonClassName("danger")}
                      disabled={deletion.processing}
                      onClick={() => remove(owner)}
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
