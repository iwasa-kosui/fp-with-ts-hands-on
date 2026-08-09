// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import EventsIndex from "../../src/adaptor/primary/web/pages/Events/Index.js";
import { EventId } from "../../src/domain/aggregate/eventId.js";
import { Timestamp } from "../../src/domain/aggregate/timestamp.js";
import { UserId } from "../../src/domain/user/userId.js";

vi.mock("@inertiajs/react", () => ({
  Link: ({ children, href, ...props }: Readonly<{
    children: React.ReactNode;
    href: string;
  }>) => createElement("a", { ...props, href }, children),
}));

const eventId = EventId.schema.parse("89000000-0000-4000-8000-000000000001");
const actorUserId = UserId.schema.parse("89000000-0000-4000-8000-000000000002");
const occurredAt = Timestamp.schema.parse("2026-08-10T01:02:03.000Z");
const events = [{
  eventId,
  aggregateId: "appointment-private",
  aggregateName: "Appointment",
  eventName: "appointment.booked",
  occurredAt,
  actorUserId,
  payloadSensitivity: "Sensitive" as const,
}];

const successfulResponse = (): Response => new Response(JSON.stringify({
  aggregateState: { ownerName: "機微な飼い主" },
  eventPayload: { visitReason: "機微な来院理由" },
}), { headers: { "Content-Type": "application/json" }, status: 200 });

describe("sensitive audit payload interaction", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  const renderPage = async (): Promise<void> => {
    await act(async () => root.render(
      <EventsIndex
        auth={{ user: { role: "Admin", userId: actorUserId } }}
        errors={{}}
        events={events}
        flash={{}}
      />,
    ));
  };

  test("開示後は機微情報へ、閉じた後は再開示ボタンへfocusを戻す", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => successfulResponse()));
    await renderPage();

    const revealButton = container.querySelector<HTMLButtonElement>(
      ".audit-payload__action button",
    );
    expect(revealButton).not.toBeNull();
    await act(async () => revealButton?.click());

    const revealed = container.querySelector<HTMLElement>(
      '[aria-label="開示した機微監査情報"]',
    );
    expect(document.activeElement).toBe(revealed);

    const closeButton = revealed?.querySelector<HTMLButtonElement>("button");
    await act(async () => closeButton?.click());
    const reopenButton = container.querySelector<HTMLButtonElement>(
      ".audit-payload__action button",
    );
    expect(reopenButton?.textContent).toBe("再開示");
    expect(document.activeElement).toBe(reopenButton);
  });

  test("閉じた後に再開示でき、unmountは未完了requestをabortする", async () => {
    const fetchMock = vi.fn(async () => successfulResponse());
    vi.stubGlobal("fetch", fetchMock);
    await renderPage();
    await act(async () => container.querySelector<HTMLButtonElement>(
      ".audit-payload__action button",
    )?.click());
    await act(async () => container.querySelector<HTMLElement>(
      '[aria-label="開示した機微監査情報"] button',
    )?.click());
    await act(async () => container.querySelector<HTMLButtonElement>(
      ".audit-payload__action button",
    )?.click());
    expect(fetchMock).toHaveBeenCalledTimes(2);

    let requestSignal: AbortSignal | undefined;
    vi.stubGlobal("fetch", vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      requestSignal = init?.signal ?? undefined;
      return new Promise<Response>(() => undefined);
    }));
    await act(async () => container.querySelector<HTMLButtonElement>(
      '[aria-label="開示した機微監査情報"] button',
    )?.click());
    await act(async () => container.querySelector<HTMLButtonElement>(
      ".audit-payload__action button",
    )?.click());
    await act(async () => root.unmount());
    expect(requestSignal?.aborted).toBe(true);
    root = createRoot(container);
  });
});
