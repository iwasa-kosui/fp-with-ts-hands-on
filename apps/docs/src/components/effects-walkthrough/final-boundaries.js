const figures = document.querySelectorAll("[data-final-boundaries]:not([data-fb-ready])");
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const tagText = { current: "いまここ", done: "通過", stopped: "先へ進まない", skipped: "通らない" };

for (const figure of figures) {
  figure.setAttribute("data-fb-ready", "");

  const root = figure.closest("[data-walk]");
  const scenes = JSON.parse(figure.dataset.frames);
  const cards = JSON.parse(figure.dataset.cards);
  const card = figure.querySelector("[data-card]");
  const cardChip = card.querySelector("[data-card-chip]");
  const cardType = card.querySelector("[data-card-type]");
  const cardVal = card.querySelector("[data-card-val]");
  const parts = [...figure.querySelectorAll("[data-stage]")].map((stage) => {
    const open = figure.querySelector(`[data-open="${stage.dataset.stage}"]`);
    return {
      stage,
      key: stage.dataset.stage,
      tag: stage.querySelector("[data-tag]"),
      dock: stage.querySelector("[data-dock]"),
      open,
      impls: [...open.querySelectorAll("[data-impl]")],
      outs: [...open.querySelectorAll("[data-out]")],
      sums: [...stage.querySelectorAll("[data-sum]")],
    };
  });
  const order = parts.map(({ key }) => key);

  let lastScene = -1;
  let width = 0;

  const revealFirst = (pre, code, marked, instant) => {
    if (pre.scrollHeight <= pre.clientHeight) return;
    const line = code.children[marked.size > 0 ? Math.min(...marked) : 0];
    const offset = line.getBoundingClientRect().top - pre.getBoundingClientRect().top + pre.scrollTop;
    const lineHeight = parseFloat(getComputedStyle(line).lineHeight) || 20;
    pre.scrollTo({ top: Math.max(0, offset - lineHeight * 1.5), behavior: instant || reduced.matches ? "instant" : "smooth" });
  };

  const showImpl = (part, name, lines, instant) => {
    for (const impl of part.impls) {
      const active = impl.dataset.impl === name;
      const wasActive = impl.hasAttribute("data-active");
      const code = impl.querySelector("pre code");
      const marked = new Set(active ? lines : []);
      impl.toggleAttribute("data-active", active);
      code.toggleAttribute("data-has-active", marked.size > 0);
      [...code.children].forEach((line, index) => line.classList.toggle("is-active", marked.has(index)));
      if (active) revealFirst(impl.querySelector("pre"), code, marked, instant || !wasActive);
    }
  };

  const apply = (force = false) => {
    const sceneIndex = Number(root.dataset.scene) || 0;
    const frameIndex = Number(root.dataset.frame) || 0;
    const scene = scenes[sceneIndex];
    const frame = scene?.frames[frameIndex];
    if (frame === undefined) return;
    const reset = force || sceneIndex !== lastScene;
    lastScene = sceneIndex;
    const before = card.getBoundingClientRect();
    if (reset) figure.classList.add("is-reset");

    const settled = {};
    for (const earlier of scene.frames.slice(0, frameIndex)) {
      if (earlier.out !== undefined) settled[earlier.at] = earlier.out;
    }
    const carried = [...scene.frames.slice(0, frameIndex + 1)].reverse().find((item) => item.out !== undefined)?.out;
    const at = order.indexOf(frame.at);
    const skipped = new Set(frame.skipped ?? []);

    parts.forEach((part, index) => {
      const { stage, key } = part;
      const state = skipped.has(key)
        ? "skipped"
        : key === frame.at
          ? "current"
          : index < at
            ? key === scene.stop
              ? "stopped"
              : "done"
            : "future";
      stage.dataset.state = state;
      stage.dataset.tone = cards[settled[key]]?.tone ?? "";
      stage.toggleAttribute("data-walk-focus", key === frame.at);
      if (state === "current") stage.setAttribute("aria-current", "step");
      else stage.removeAttribute("aria-current");
      part.tag.textContent = tagText[state] ?? "";
      part.open.toggleAttribute("data-current", state === "current");
      part.open.inert = state !== "current";
      if (state === "current") {
        showImpl(part, frame.impl, frame.lines ?? [], reset);
        for (const out of part.outs) out.toggleAttribute("data-active", out.dataset.out === frame.out);
      }
      for (const item of part.sums) item.toggleAttribute("data-active", item.dataset.sum === settled[key]);
    });

    const data = cards[carried];
    card.dataset.tone = data.tone;
    cardChip.textContent = data.chip;
    cardType.textContent = data.type;
    cardVal.textContent = data.short;

    const target = parts[at].dock;
    const moved = card.parentElement !== target;
    if (moved) target.append(card);
    for (const { dock } of parts) dock.style.height = dock.contains(card) ? `${card.offsetHeight}px` : "0px";

    if (moved && !reset) {
      const after = card.getBoundingClientRect();
      card.style.transition = "none";
      card.style.transform = `translate(${before.left - after.left}px, ${before.top - after.top}px)`;
      void card.offsetWidth;
      card.style.transition = "";
      card.style.transform = "";
    }

    if (reset) {
      void figure.offsetWidth;
      figure.classList.remove("is-reset");
    }
  };

  root.addEventListener("stepchange", () => apply());
  new ResizeObserver(() => {
    if (figure.offsetWidth === width) return;
    width = figure.offsetWidth;
    apply(true);
  }).observe(figure);
  apply();
}
