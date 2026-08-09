import type { EventView } from "../../../../../useCase/listEventsUseCase.js";
import { DataTable } from "../../components/DataTable.js";
import { eventPresentation } from "../../components/eventPresentation.js";
import { EmptyState, InlineAlert } from "../../components/Surface.js";
import type { SharedPageProps } from "../../pageProps.js";
import Layout from "../Layout.js";

type Props = SharedPageProps & Readonly<{ events: readonly EventView[] }>;

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const Fields = ({ value }: Readonly<{
  value: Readonly<Record<string, unknown>> | null;
}>) => {
  if (value === null) return <span>なし</span>;
  const fields = Object.entries(value);
  return fields.length === 0 ? (
    <span>なし</span>
  ) : (
    <dl className="audit-fields">
      {fields.map(([key, item]) => (
        <div key={key}>
          <dt>{key}</dt>
          <dd>{typeof item === "object" ? JSON.stringify(item) : String(item)}</dd>
        </div>
      ))}
    </dl>
  );
};

const RegularPayload = ({ event }: Readonly<{ event: EventView }>) => {
  if (event.payloadSensitivity === "Sensitive") {
    return <span>機微情報を含みます</span>;
  }
  const state = event.regularPayload?.aggregateState;
  const stateRecord = isRecord(state) ? state : null;
  return (
    <>
      <strong>状態</strong>
      <Fields value={stateRecord} />
      <strong>ペイロード</strong>
      <Fields value={event.regularPayload?.eventPayload ?? null} />
    </>
  );
};

export default function EventsIndex({ auth, events }: Props) {
  return (
    <Layout activeNavigation="events" title="イベント履歴" user={auth.user}>
      <InlineAlert>
        監査履歴には個人情報を表示しません。機微な本文は通常の一覧から分離して保持されます。
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
              <th scope="col">記録内容</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => {
              const presentation = eventPresentation(event.eventName);
              return presentation.kind === "Unknown" ? (
                <tr key={event.eventId}>
                  <td colSpan={6}>
                    <strong>{presentation.label}</strong><br />
                    <small>{event.eventId}</small>
                  </td>
                </tr>
              ) : (
                <tr key={event.eventId}>
                  <td>{event.occurredAt}</td>
                  <td>{event.eventId}</td>
                  <td>{presentation.label}</td>
                  <td>{event.aggregateName}<br /><small>{event.aggregateId}</small></td>
                  <td>{event.actorUserId}</td>
                  <td><RegularPayload event={event} /></td>
                </tr>
              );
            })}
          </tbody>
        </DataTable>
      )}
    </Layout>
  );
}
