import { useEffect, useRef, useState } from "react";

import { SensitiveAuditPayload } from "../../../../../useCase/query/sensitiveAuditPayloadDisclosure.js";
import type { EventView } from "../../../../../useCase/listEventsUseCase.js";
import { Button } from "../../components/Button.js";
import { DataTable } from "../../components/DataTable.js";
import { eventPresentation } from "../../components/eventPresentation.js";
import { EmptyState, InlineAlert } from "../../components/Surface.js";
import type { SharedPageProps } from "../../pageProps.js";
import Layout from "../Layout.js";

type Props = SharedPageProps & Readonly<{ events: readonly EventView[] }>;

type RevealState =
  | Readonly<{ kind: "Closed" }>
  | Readonly<{ kind: "Loading" }>
  | Readonly<{ kind: "Revealed"; payload: SensitiveAuditPayload }>
  | Readonly<{ kind: "Error" }>;

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

const JsonDocument = ({ value }: Readonly<{ value: unknown }>) => (
  <pre className="audit-payload__json">{JSON.stringify(value, null, 2)}</pre>
);

export const SensitiveAuditPayloadDetail = ({
  payload,
  onClose,
}: Readonly<{
  payload: SensitiveAuditPayload;
  onClose: () => void;
}>) => (
  <section aria-label="開示した機微監査情報" className="audit-payload">
    <InlineAlert>
      個人情報・診療情報を含みます。業務上必要な場合だけ確認してください。
    </InlineAlert>
    <h3>集約状態（JSON）</h3>
    <JsonDocument value={payload.aggregateState} />
    <h3>イベントペイロード（JSON）</h3>
    <JsonDocument value={payload.eventPayload} />
    <Button type="button" variant="secondary" onClick={onClose}>
      閉じる
    </Button>
  </section>
);

const SensitivePayload = ({ eventId }: Readonly<{ eventId: string }>) => {
  const [state, setState] = useState<RevealState>();
  const request = useRef<AbortController | undefined>(undefined);
  useEffect(() => () => request.current?.abort(), []);

  const reveal = async (): Promise<void> => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setState({ kind: "Loading" });
    try {
      const response = await fetch(`/events/${eventId}/sensitive-payload`, {
        method: "POST",
        headers: { Accept: "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        referrerPolicy: "no-referrer",
        signal: controller.signal,
      });
      if (!response.ok) throw new TypeError("Sensitive payload reveal failed");
      const payload = SensitiveAuditPayload.parse(await response.json());
      if (payload.isErr()) throw new TypeError("Invalid sensitive payload response");
      if (!controller.signal.aborted) {
        setState({ kind: "Revealed", payload: payload.value });
      }
    } catch (cause) {
      if (
        !controller.signal.aborted &&
        !(cause instanceof DOMException && cause.name === "AbortError")
      ) {
        setState({ kind: "Error" });
      }
    }
  };

  if (state?.kind === "Revealed") {
    return (
      <SensitiveAuditPayloadDetail
        payload={state.payload}
        onClose={() => setState({ kind: "Closed" })}
      />
    );
  }
  return (
    <div className="audit-payload__action">
      <span>機微情報を含みます</span>
      {state?.kind === "Error" ? (
        <span role="alert">開示できませんでした。もう一度お試しください。</span>
      ) : null}
      <Button
        type="button"
        variant="secondary"
        disabled={state?.kind === "Loading"}
        onClick={() => void reveal()}
      >
        {state?.kind === "Loading"
          ? "開示中…"
          : state?.kind === "Closed" || state?.kind === "Error"
            ? "再開示"
            : "機微情報を開示"}
      </Button>
    </div>
  );
};

const EventPayload = ({ event }: Readonly<{ event: EventView }>) =>
  event.payloadSensitivity === "Sensitive"
    ? <SensitivePayload eventId={event.eventId} />
    : <RegularPayload event={event} />;

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
                    {event.payloadSensitivity === "Sensitive" ? (
                      <SensitivePayload eventId={event.eventId} />
                    ) : null}
                  </td>
                </tr>
              ) : (
                <tr key={event.eventId}>
                  <td>{event.occurredAt}</td>
                  <td>{event.eventId}</td>
                  <td>{presentation.label}</td>
                  <td>{event.aggregateName}<br /><small>{event.aggregateId}</small></td>
                  <td>{event.actorUserId}</td>
                  <td><EventPayload event={event} /></td>
                </tr>
              );
            })}
          </tbody>
        </DataTable>
      )}
    </Layout>
  );
}
