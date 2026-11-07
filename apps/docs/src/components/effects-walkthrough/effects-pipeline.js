const figures = document.querySelectorAll("[data-effects-pipeline]:not([data-ep-ready])");
const reduced = matchMedia("(prefers-reduced-motion: reduce)");

for (const figure of figures) {
  figure.setAttribute("data-ep-ready", "");

  const root = figure.closest("[data-walk]");
  const scenes = JSON.parse(figure.dataset.frames);
  const parts = [...figure.querySelectorAll("[data-stage]")].map((stage) => ({
    stage,
    key: stage.dataset.stage,
    open: stage.querySelector(".ep-open"),
    impls: [...stage.querySelectorAll("[data-impl]")],
    outs: [...stage.querySelectorAll("[data-out]")],
    sums: [...stage.querySelectorAll("[data-sum]")],
  }));
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
    if (reset) figure.classList.add("is-reset");

    const settled = { ...scene.settled };
    for (const earlier of scene.frames.slice(0, frameIndex)) {
      if (earlier.out !== undefined) settled[earlier.at] = earlier.out;
    }
    const at = order.indexOf(frame.at);
    const skipped = new Set(frame.skipped ?? []);
    const from = frame.flow === undefined ? -1 : order.indexOf(frame.flow.from);
    const to = frame.flow === undefined ? -1 : order.indexOf(frame.flow.to);

    parts.forEach((part, index) => {
      const { stage, key } = part;
      if (key === "sig") return;
      const hidden = stage.hasAttribute("data-outer") && key !== scene.outer;
      const state = skipped.has(key) ? "skipped" : key === frame.at ? "current" : index < at ? "done" : "future";
      const inFlow = frame.flow !== undefined && index >= from && index <= to;
      stage.hidden = hidden;
      stage.toggleAttribute("data-walk-focus", key === frame.at);
      stage.dataset.state = state;
      stage.dataset.rail = inFlow && frame.flow.kind === "err" ? "err" : "";
      stage.dataset.reject = inFlow && frame.flow.kind === "reject" ? "on" : "";
      part.open.inert = state !== "current";
      if (state === "current") {
        showImpl(part, frame.impl, frame.lines ?? [], reset);
        for (const out of part.outs) out.toggleAttribute("data-active", out.dataset.out === frame.out);
      }
      for (const item of part.sums) item.toggleAttribute("data-active", item.dataset.sum === settled[key]);
    });

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
