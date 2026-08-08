import { useForm } from "@inertiajs/react";

import { ErrorSummary } from "../../components/FormErrors.js";
import type { SharedPageProps } from "../../pageProps.js";
import type { FollowUpPageView } from "../../routes/followUpRoutes.js";
import Layout from "../Layout.js";

type Props = SharedPageProps &
  Readonly<{ followUps: readonly FollowUpPageView[] }>;

export default function FollowUpsIndex({ auth, errors, followUps }: Props) {
  const form = useForm<{ appointmentIds: string[] }>({ appointmentIds: [] });
  const toggle = (appointmentId: string, selected: boolean) =>
    form.setData(
      "appointmentIds",
      selected
        ? [...form.data.appointmentIds, appointmentId]
        : form.data.appointmentIds.filter((value) => value !== appointmentId),
    );
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    form.post("/follow-ups/request", { forceFormData: true, preserveScroll: true });
  };

  return (
    <Layout title="フォローアップ" user={auth.user}>
      <ErrorSummary errors={errors} />
      {followUps.length === 0 ? (
        <p>電話フォローが必要な診察はありません。</p>
      ) : (
        <form onSubmit={submit}>
          <table>
            <thead>
              <tr>
                <th scope="col">選択</th>
                <th scope="col">飼い主</th>
                <th scope="col">電話番号</th>
                <th scope="col">予約</th>
                <th scope="col">依頼状況</th>
              </tr>
            </thead>
            <tbody>
              {followUps.map((followUp) => (
                <tr key={followUp.appointmentId}>
                  <td>
                    <input
                      aria-label={`${followUp.ownerName} のフォローアップを選択`}
                      checked={form.data.appointmentIds.includes(followUp.appointmentId)}
                      disabled={followUp.requested || form.processing}
                      name="appointmentIds"
                      onChange={(event) => toggle(followUp.appointmentId, event.target.checked)}
                      type="checkbox"
                      value={followUp.appointmentId}
                    />
                  </td>
                  <td>{followUp.ownerName}</td>
                  <td>{followUp.ownerPhone}</td>
                  <td>{followUp.appointmentId}</td>
                  <td>{followUp.requested ? "依頼済み" : "未依頼"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            disabled={form.processing || form.data.appointmentIds.length === 0}
            type="submit"
          >
            {form.processing ? "依頼中…" : "フォローアップを依頼"}
          </button>
        </form>
      )}
    </Layout>
  );
}
