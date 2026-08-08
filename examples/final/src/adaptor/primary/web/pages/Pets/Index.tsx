import { Link, useForm } from "@inertiajs/react";

import type { PetPageView } from "../../routes/petRoutes.js";
import type { SharedPageProps } from "../../pageProps.js";
import Layout from "../Layout.js";

type PetsIndexProps = SharedPageProps &
  Readonly<{ pets: readonly PetPageView[] }>;

export default function PetsIndex({ auth, pets }: PetsIndexProps) {
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
    <Layout title="ペット管理" user={auth.user}>
      <p><Link href="/pets/new">ペットを追加</Link></p>
      <p className="notice">
        削除後も診療・監査履歴は保持されます。履歴の消去操作ではありません。
      </p>
      {pets.length === 0 ? (
        <p>ペットはいません。</p>
      ) : (
        <table>
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
                  <button
                    disabled={deletion.processing}
                    onClick={() => remove(pet)}
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
