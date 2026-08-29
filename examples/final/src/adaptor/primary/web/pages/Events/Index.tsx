import type { EventView } from "../../../../../useCase/listEventsUseCase.js";
import type { SanitizedAuditValue } from "../../../../../domain/audit/eventHistoryReader.js";
import { DataTable } from "@fp-with-ts/clinic-web";
import { EmptyState, InlineAlert } from "@fp-with-ts/clinic-web";
import type { SharedPageProps } from "../../pageProps.js";
import Layout from "../Layout.js";

type Props = SharedPageProps & Readonly<{ events: readonly EventView[] }>;

const Fields = ({ value }: Readonly<{
  value: Readonly<Record<string, SanitizedAuditValue>> | undefined;
}>) => {
  if (value === undefined) return <span>なし</span>;
  const fields = Object.entries(value);
  return fields.length === 0 ? (
    <span>なし</span>
  ) : (
    <dl className="audit-fields">
      {fields.map(([key, item]) => (
        <div key={key}>
          <dt>{key}</dt>
          <dd>{String(item)}</dd>
        </div>
      ))}
    </dl>
  );
};

export default function EventsIndex({ auth, events }: Props) {
  return (
    <Layout activeNavigation="events" title="イベント履歴" user={auth.user}>
      <InlineAlert>
        監査履歴には個人情報を表示しません。許可された記録は監査のため保持されます。
      </InlineAlert>
      {events.length === 0 ? (
        <EmptyState>イベントはありません。</EmptyState>
      ) : (
        <DataTable label="監査イベント一覧">
          <thead>
            <tr>
              <th scope="col">発生日時</th>
              <th scope="col">イベント ID</th>
              <th scope="col">イベント名</th>
              <th scope="col">集約</th>
              <th scope="col">実行者</th>
              <th scope="col">許可済み状態</th>
              <th scope="col">許可済みペイロード</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.eventId}>
                <td>{event.occurredAt}</td>
                <td>{event.eventId}</td>
                <td>{event.eventName}</td>
                <td>{event.aggregateName}<br /><small>{event.aggregateId}</small></td>
                <td>{event.actorUserId}</td>
                <td><Fields value={event.aggregateState} /></td>
                <td><Fields value={event.eventPayload} /></td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      )}
    </Layout>
  );
}
