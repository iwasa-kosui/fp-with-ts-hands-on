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
      open,
      impls: [...open.querySelectorAll("[data-impl]")],
      outs: [...open.querySelectorAll("[data-out]")],
    };
  });
  const order = parts.map(({ key }) => key);

  let lastScene = -1;
  let lastAt = -1;
  let width = 0;

  const revealFirst = (pre, code, marked, instant) => {
    pre.style.paddingBottom = "";
    if (pre.scrollHeight <= pre.clientHeight) return;
    const line = code.children[marked.size > 0 ? Math.min(...marked) : 0];
    const offset = Math.round(line.getBoundingClientRect().top - pre.getBoundingClientRect().top + pre.scrollTop);
    const slack = offset + pre.clientHeight - pre.scrollHeight;
    if (slack > 0) pre.style.paddingBottom = `calc(0.1rem + ${slack}px)`;
    pre.scrollTo({ top: offset, behavior: instant || reduced.matches ? "instant" : "smooth" });
  };

  const showImpl = (part, name, lines, instant) => {
    const shown = [];
    for (const impl of part.impls) {
      const active = impl.dataset.impl === name;
      const wasActive = impl.hasAttribute("data-active");
      const code = impl.querySelector("pre code");
      const marked = new Set(active ? lines : []);
      impl.toggleAttribute("data-active", active);
      code.toggleAttribute("data-has-active", marked.size > 0);
      [...code.children].forEach((line, index) => line.classList.toggle("is-active", marked.has(index)));
      if (active) shown.push({ impl, code, marked, instant: instant || !wasActive });
    }
    for (const { impl, code, marked, instant: now } of shown) revealFirst(impl.querySelector("pre"), code, marked, now);
  };

  const apply = (force = false) => {
    const sceneIndex = Number(root.dataset.scene) || 0;
    const frameIndex = Number(root.dataset.frame) || 0;
    const scene = scenes[sceneIndex];
    const frame = scene?.frames[frameIndex];
    if (frame === undefined) return;
    const reset = force || sceneIndex !== lastScene;
    lastScene = sceneIndex;
    if (reset) figure.classList.add("is-reset");

    const settled = {};
    for (const earlier of scene.frames.slice(0, frameIndex)) {
      if (earlier.out !== undefined) settled[earlier.at] = earlier.out;
    }
    const carried = [...scene.frames.slice(0, frameIndex + 1)].reverse().find((item) => item.out !== undefined)?.out;
    const at = order.indexOf(frame.at);
    const entered = at !== lastAt;
    lastAt = at;
    const skipped = new Set(frame.skipped ?? []);

    const data = cards[carried];
    card.dataset.tone = data.tone;
    cardChip.textContent = data.chip;
    cardType.textContent = data.type;
    cardVal.textContent = data.short;

    let currentPart;
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
        for (const out of part.outs) out.toggleAttribute("data-active", out.dataset.out === frame.out);
        currentPart = part;
      }
    });
    if (currentPart !== undefined) showImpl(currentPart, frame.impl, frame.lines ?? [], reset || entered);

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
