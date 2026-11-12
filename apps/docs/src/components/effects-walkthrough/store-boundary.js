const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const figures = document.querySelectorAll("[data-store-boundary]:not([data-sb-ready])");
const chipText = {
  tx: "未確定",
  "tx-failed": "失敗",
  "tx-gone": "取り消し",
  home: "確定",
  "home-failed": "失敗",
};
const txText = {
  commit: "transaction: 確定",
  rollback: "transaction: 取り消し",
  ended: "transaction: 確定（書き込みなし）",
};
const pageTxText = { open: "transaction の中", ...txText };
const slotStates = new Set(["tx", "tx-failed", "tx-gone"]);

for (const figure of figures) {
  figure.setAttribute("data-sb-ready", "");
  const page = figure.classList.contains("sb--page");
  if (figure.hasAttribute("data-written-only")) chipText.home = "書き込み済み";
  const failed = figure.querySelector("[data-failed]");
  const issue = figure.querySelector("[data-issue]");
  const compare = figure.querySelector("[data-compare]");

  const root = figure.closest("[data-walk]");
  const frames = JSON.parse(figure.dataset.frames);
  const boxes = {};
  for (const box of figure.querySelectorAll("[data-box]")) {
    boxes[box.dataset.box] = [...box.querySelectorAll("[data-pane]")];
  }
  const tx = figure.querySelector("[data-tx]");
  const txLabel = figure.querySelector("[data-tx-label]");
  const appointments = figure.querySelector('[data-table="appointments"]');
  const slots = {
    state: figure.querySelector('[data-slot="state"]'),
    audit: figure.querySelector('[data-slot="audit"]'),
  };
  const cards = {};
  for (const card of figure.querySelectorAll("[data-card]")) cards[card.dataset.card] = card;

  let lastScene = -1;
  let width = 0;

  const revealFirst = (pre, code, marked, instant) => {
    if (pre.scrollHeight <= pre.clientHeight) return;
    const line = code.children[marked.size > 0 ? Math.min(...marked) : 0];
    const offset = line.getBoundingClientRect().top - pre.getBoundingClientRect().top + pre.scrollTop;
    const lineHeight = parseFloat(getComputedStyle(line).lineHeight) || 20;
    const last = code.children[marked.size > 0 ? Math.max(...marked) : 0];
    const room = Math.max(0, pre.clientHeight - 2 - (last.getBoundingClientRect().bottom - line.getBoundingClientRect().top));
    pre.scrollTo({ top: Math.max(0, offset - Math.min(lineHeight * 1.5, room / 2)), behavior: instant || reduced.matches ? "instant" : "smooth" });
  };

  const stacked = () => getComputedStyle(figure).getPropertyValue("--sb-stacked").trim() === "1";

  const fitImpl = (pane) => {
    const callStack = boxEls.call.querySelector(".sb-stack");
    const callHeight = boxEls.call.hasAttribute("data-hidden") ? 0 : parseFloat(callStack.style.height) || 0;
    const area = figure.querySelector(".sb-code");
    const pre = pane.querySelector("pre");
    if (stacked()) {
      pre.style.maxHeight = "";
      return;
    }
    const room = area.clientHeight - parseFloat(getComputedStyle(area).rowGap) - callHeight;
    pre.style.maxHeight = `${Math.max(0, room - (pane.getBoundingClientRect().height - pre.getBoundingClientRect().height))}px`;
  };

  const boxEls = {};
  for (const box of figure.querySelectorAll("[data-box]")) boxEls[box.dataset.box] = box;
  const diagram = figure.querySelector(".sb-diagram");

  const showPane = (name, spec, instant) => {
    const wasHidden = boxEls[name].hasAttribute("data-hidden");
    boxEls[name].toggleAttribute("data-hidden", spec === null);
    boxEls[name].inert = spec === null;
    if (spec === null) return;
    for (const pane of boxes[name]) {
      const active = pane.dataset.pane === spec.pane;
      const wasActive = pane.hasAttribute("data-active");
      const code = pane.querySelector("pre code");
      const marked = new Set(active ? spec.lines : []);
      pane.toggleAttribute("data-active", active);
      code.toggleAttribute("data-has-active", marked.size > 0);
      [...code.children].forEach((line, index) => line.classList.toggle("is-active", marked.has(index)));
      if (active) {
        if (page && name === "impl") fitImpl(pane);
        const stack = pane.parentElement;
        if (instant || wasHidden) stack.style.transition = "none";
        stack.style.height = `${Math.ceil(pane.getBoundingClientRect().height)}px`;
        if (instant || wasHidden) {
          void stack.offsetHeight;
          stack.style.transition = "";
        }
      }
      if (name === "impl" && active) revealFirst(pane.querySelector("pre"), code, marked, instant || !wasActive);
    }
  };

  const setOld = (key, shown, reset) => {
    const state = shown ? "old" : "off";
    cards[key].toggleAttribute("data-walk-keep", !reset && state !== cards[key].dataset.state && shown);
    cards[key].dataset.state = state;
  };

  const setCard = (key, state, withTx, reset) => {
    const card = cards[key];
    card.toggleAttribute("data-walk-keep", !reset && state !== card.dataset.state && state !== "off");
    card.dataset.state = state;
    if (state in chipText) card.querySelector("[data-chip]").textContent = chipText[state];
    if (slots[key] !== null && (slotStates.has(state) || (state === "off" && withTx))) {
      const home = card.parentElement.getBoundingClientRect();
      const target = slots[key].getBoundingClientRect();
      card.style.transform = `translate(${target.left - home.left}px, ${target.top - home.top}px)`;
    } else {
      card.style.transform = "";
    }
  };

  const apply = (force = false, scene = Number(root.dataset.scene) || 0, index = Number(root.dataset.frame) || 0) => {
    const frame = frames[scene]?.[index];
    if (frame === undefined) return;
    const reset = force || scene !== lastScene;
    lastScene = scene;
    if (reset) figure.classList.add("is-reset");

    figure.toggleAttribute("data-no-code", frame.call === null && frame.impl === null);
    showPane("call", frame.call, reset);
    showPane("impl", frame.impl, reset);
    boxEls.impl.toggleAttribute("data-walk-focus", frame.impl !== null);
    diagram.toggleAttribute("data-walk-focus", frame.impl === null);
    tx.dataset.tx = frame.tx;
    txLabel.textContent = page ? (pageTxText[frame.tx] ?? "") : (txText[frame.tx] ?? "transaction");
    if (issue !== null) issue.toggleAttribute("data-on", frame.issue === true);
    appointments.toggleAttribute("data-read", frame.read === true);
    setOld("old-CheckedIn", frame.old === "CheckedIn", reset);
    setOld("old-InExamination", frame.old === "InExamination", reset);
    if (cards["old-audit"] !== undefined) setOld("old-audit", frame.oldAudit === true, reset);
    if (compare !== null) compare.toggleAttribute("data-on", frame.compare === true);
    setCard("state", frame.state, frame.tx !== "none", reset);
    const auditFailed = failed !== null && frame.audit.endsWith("failed");
    setCard("audit", auditFailed ? "off" : frame.audit, frame.tx !== "none", reset);
    if (failed !== null) failed.toggleAttribute("data-on", auditFailed);

    if (reset) {
      void figure.offsetWidth;
      figure.classList.remove("is-reset");
    }
  };

  const fitStack = () => {
    const isStacked = stacked();
    root.toggleAttribute("data-sb-stacked", isStacked);
    figure.style.minHeight = "";
    if (isStacked) {
      let tallest = 0;
      frames.forEach((list, scene) =>
        list.forEach((_, index) => {
          apply(true, scene, index);
          tallest = Math.max(tallest, figure.getBoundingClientRect().height);
        }),
      );
      figure.style.minHeight = `${Math.ceil(tallest)}px`;
    }
    apply(true);
  };

  root.addEventListener("stepchange", () => apply());
  new ResizeObserver(() => {
    if (figure.offsetWidth === width) return;
    width = figure.offsetWidth;
    fitStack();
  }).observe(figure);
  apply();
}
