import type { EventView } from "../../../../../useCase/listEventsUseCase.js";
import type { SharedPageProps } from "../../pageProps.js";
import Layout from "../Layout.js";

type Props = SharedPageProps & Readonly<{ events: readonly EventView[] }>;

const Fields = ({ value }: Readonly<{ value: Readonly<Record<string, unknown>> | undefined }>) => {
  if (value === undefined) return <span>なし</span>;
  const fields = Object.entries(value);
  return fields.length === 0 ? (
    <span>なし</span>
  ) : (
    <dl className="event-fields">
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
    <Layout title="イベント履歴" user={auth.user}>
      <p className="notice">
        監査用に許可されたメタデータだけを表示します。秘匿項目は [REDACTED] と表示されます。
      </p>
      {events.length === 0 ? (
        <p>イベントはありません。</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th scope="col">発生日時</th>
              <th scope="col">イベント</th>
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
                <td>{event.eventName}<br /><small>{event.eventId}</small></td>
                <td>{event.aggregateName}<br /><small>{event.aggregateId}</small></td>
                <td>{event.actorUserId}</td>
                <td><Fields value={event.aggregateState} /></td>
                <td><Fields value={event.eventPayload} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Layout>
  );
}
