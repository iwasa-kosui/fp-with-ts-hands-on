import { Link, useForm } from "@inertiajs/react";

import type { PetPageView } from "../../routes/petRoutes.js";
import type { SharedPageProps } from "../../pageProps.js";
import { buttonClassName } from "../../components/Button.js";
import { DataTable } from "../../components/DataTable.js";
import { ErrorSummary } from "../../components/FormErrors.js";
import { EmptyState, InlineAlert } from "../../components/Surface.js";
import Layout from "../Layout.js";

type PetsIndexProps = SharedPageProps &
  Readonly<{ pets: readonly PetPageView[] }>;

export default function PetsIndex({ auth, errors, pets }: PetsIndexProps) {
  const deletion = useForm({});
  const remove = (pet: PetPageView) => {
    if (
      window.confirm(
        `${pet.name} を削除しますか？関連する診療・監査履歴は保持されます。`,
      )
    ) {
      deletion.post(`/pets/${pet.petId}/delete`, { forceFormData: true });
    }
  };

  return (
    <Layout
      actions={
        <Link className={buttonClassName()} href="/pets/new">
          ペットを追加
        </Link>
      }
      activeNavigation="pets"
      title="ペット管理"
      user={auth.user}
    >
      <ErrorSummary errors={errors} />
      <InlineAlert>
        削除後も診療・監査履歴は保持されます。履歴の消去操作ではありません。
      </InlineAlert>
      {pets.length === 0 ? (
        <EmptyState>ペットはいません。</EmptyState>
      ) : (
        <DataTable label="ペット一覧">
          <thead>
            <tr><th scope="col">名前</th><th scope="col">種別</th><th scope="col">飼い主 ID</th><th scope="col">操作</th></tr>
          </thead>
          <tbody>
            {pets.map((pet) => (
              <tr key={pet.petId}>
                <td><Link href={`/pets/${pet.petId}`}>{pet.name}</Link></td>
                <td>{pet.species}</td>
                <td>{pet.ownerId}</td>
                <td>
                  <div className="table-actions">
                    <Link className={buttonClassName("secondary")} href={`/pets/${pet.petId}`}>編集</Link>
                    <button
                      className={buttonClassName("danger")}
                      disabled={deletion.processing}
                      onClick={() => remove(pet)}
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
