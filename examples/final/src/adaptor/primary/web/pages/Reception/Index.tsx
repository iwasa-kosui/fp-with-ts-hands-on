import { router } from "@inertiajs/react";
import { useEffect, useRef, useState } from "react";

import type { Timestamp } from "../../../../../domain/aggregate/timestamp.js";
import type { ReceptionBoard } from "../../../../../useCase/query/receptionBoardReader.js";
import { buttonClassName } from "../../components/Button.js";
import { ReceptionSection } from "../../components/ReceptionSection.js";
import type { SharedPageProps } from "../../pageProps.js";
import { startReceptionPolling } from "../../receptionPolling.js";
import Layout from "../Layout.js";

type Props = SharedPageProps & Readonly<{ board: ReceptionBoard; currentTime: Timestamp }>;

const loadedAtLabel = (timestamp: Timestamp): string => new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
}).format(new Date(timestamp));

export default function ReceptionIndex({ auth, board, currentTime: _currentTime }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const busy = useRef(false);
  busy.current = submitting;
  const reload = () => {
    setSubmitting(true);
    router.reload({ only: ["board"], onFinish: () => setSubmitting(false) });
  };

  useEffect(() => {
    let routerBusy = false;
    const offStart = router.on("start", () => { routerBusy = true; });
    const offFinish = router.on("finish", () => { routerBusy = false; });
    const stop = startReceptionPolling({
      setInterval: (callback, milliseconds) => window.setInterval(callback, milliseconds),
      clearInterval: (handle) => window.clearInterval(Number(handle)),
      isVisible: () => document.visibilityState === "visible",
      subscribeVisibility: (listener) => { document.addEventListener("visibilitychange", listener); return () => document.removeEventListener("visibilitychange", listener); },
      isBusy: () => busy.current || routerBusy,
      reload: (onFinish) => router.reload({ only: ["board"], onFinish }),
    });
    return () => { stop(); offStart(); offFinish(); };
  }, []);

  const sections = [
    { key: "scheduled", label: "予約済", rows: board.scheduled, expanded: true },
    { key: "checked-in", label: "受付済", rows: board.checkedIn, expanded: true },
    { key: "in-examination", label: "診察中", rows: board.inExamination, expanded: true },
    { key: "awaiting-payment", label: "会計待ち", rows: board.awaitingPayment, expanded: true },
    { key: "paid", label: "完了", rows: board.paid, expanded: false },
    { key: "canceled", label: "キャンセル", rows: board.canceled, expanded: false },
  ] as const;
  return <Layout
    activeNavigation="reception"
    actions={<button aria-busy={submitting || undefined} className={buttonClassName("secondary")} disabled={submitting} onClick={reload} type="button">{submitting ? "更新中…" : "更新"}</button>}
    description={`${board.businessDate}（JST）の受付状況`}
    title="受付ボード"
    user={auth.user}
  >
    <p aria-live="polite" className="reception-board__updated">最終更新 {loadedAtLabel(board.loadedAt)}</p>
    <div aria-label="受付状況" className="reception-board">
      {sections.map((section) => <ReceptionSection
        initiallyExpanded={section.expanded}
        key={section.key}
        label={section.label}
        onSubmittingChange={setSubmitting}
        rows={section.rows}
        sectionKey={section.key}
      />)}
    </div>
  </Layout>;
}
