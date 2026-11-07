const roots = document.querySelectorAll("[data-walk]:not([data-walk-ready])");
const reduced = matchMedia("(prefers-reduced-motion: reduce)");

for (const root of roots) {
  root.setAttribute("data-walk-ready", "");

  const sceneEls = [...root.querySelectorAll("[data-walk-scene]")];
  const items = sceneEls.map((el) => [...el.querySelectorAll("li")]);
  const tabs = [...root.querySelectorAll("[data-walk-tab]")];
  const live = root.querySelector("[data-walk-live]");
  const sticky = root.querySelector(".walk__sticky");
  const progress = root.querySelector("[data-walk-progress]");
  const button = (name) => root.querySelector(`[data-walk-action="${name}"]`);
  const first = button("first");
  const prev = button("prev");
  const play = button("play");
  const next = button("next");

  let scene = 0;
  let frame = 0;
  let playing = false;
  let timer = 0;
  let width = 0;
  let revealToken = 0;

  const lastFrame = () => items[scene].length - 1;
  const isDisabled = (el) => el.getAttribute("aria-disabled") === "true";
  const setDisabled = (el, value) => el.setAttribute("aria-disabled", String(value));

  const fitLive = () => {
    if (reduced.matches || live.offsetWidth === 0) return;
    const probe = live.cloneNode(false);
    probe.removeAttribute("aria-live");
    probe.removeAttribute("data-walk-live");
    probe.setAttribute("aria-hidden", "true");
    probe.style.cssText = `position:absolute;visibility:hidden;pointer-events:none;min-height:0;width:${live.offsetWidth}px`;
    live.after(probe);
    let tallest = 0;
    for (const li of items[scene]) {
      probe.innerHTML = li.innerHTML;
      tallest = Math.max(tallest, probe.offsetHeight);
    }
    probe.remove();
    live.style.minHeight = `max(${tallest}px, var(--walk-live-floor))`;
  };

  const reveal = () => {
    const token = ++revealToken;
    let seen = "";
    let still = 0;
    let ticks = 0;
    const tick = () => {
      if (token !== revealToken) return;
      const target = root.querySelector("[data-walk-focus]");
      if (target === null) return;
      const box = target.getBoundingClientRect();
      const keeps = [...root.querySelectorAll("[data-walk-keep]")].map((el) => el.getBoundingClientRect());
      const line = keeps.length > 0 ? target.querySelector(".line.is-active") : null;
      const marked = line === null ? [] : [line.getBoundingClientRect()];
      const key = [box, ...keeps, ...marked].map((rect) => `${rect.top}|${rect.bottom}`).join(",");
      still = key === seen ? still + 1 : 0;
      seen = key;
      ticks += 1;
      if (still < 4 && ticks < 120) {
        requestAnimationFrame(tick);
        return;
      }
      const shown = sticky.getBoundingClientRect().bottom;
      if (shown <= 0 || shown >= innerHeight) return;
      const stuck = (parseFloat(getComputedStyle(sticky).top) || 0) + sticky.offsetHeight;
      let top = box.top >= stuck && box.bottom <= innerHeight ? 0 : box.top - stuck - 8;
      const lowest = Math.max(...keeps.map((rect) => rect.bottom));
      if (lowest - top > innerHeight - 8) {
        top = lowest - innerHeight + 8;
        if (marked.length > 0) top = Math.min(top, marked[0].top - stuck - 8);
      }
      if (top === 0) return;
      scrollBy({ top, behavior: reduced.matches ? "instant" : "smooth" });
    };
    requestAnimationFrame(tick);
  };

  const renderPlay = () => {
    play.textContent = playing ? "一時停止" : frame >= lastFrame() ? "最初から再生" : "再生";
  };

  const show = (nextScene, nextFrame, follow = true) => {
    const sceneChanged = nextScene !== scene;
    scene = nextScene;
    frame = nextFrame;
    root.dataset.scene = String(scene);
    root.dataset.frame = String(frame);
    sceneEls.forEach((el, index) => el.toggleAttribute("data-current", index === scene));
    items.forEach((list, sceneIndex) =>
      list.forEach((li, frameIndex) => {
        if (sceneIndex === scene && frameIndex === frame) li.setAttribute("aria-current", "step");
        else li.removeAttribute("aria-current");
      }),
    );
    tabs.forEach((tab, index) => tab.setAttribute("aria-pressed", String(index === scene)));
    progress.textContent = `${frame + 1} / ${items[scene].length}`;
    if (sceneChanged) fitLive();
    live.innerHTML = items[scene][frame].innerHTML;
    setDisabled(first, frame === 0);
    setDisabled(prev, frame === 0);
    setDisabled(next, frame >= lastFrame());
    renderPlay();
    root.dispatchEvent(new CustomEvent("stepchange", { detail: { scene, frame } }));
    if (follow) reveal();
  };

  const stop = () => {
    clearTimeout(timer);
    playing = false;
    renderPlay();
  };

  const schedule = () => {
    clearTimeout(timer);
    const length = items[scene][frame].textContent.length;
    timer = setTimeout(advance, Math.max(4000, length * 130));
  };

  function advance() {
    show(scene, frame + 1);
    if (frame >= lastFrame()) stop();
    else schedule();
  }

  first.addEventListener("click", () => {
    if (isDisabled(first)) return;
    stop();
    show(scene, 0);
  });
  prev.addEventListener("click", () => {
    if (isDisabled(prev)) return;
    stop();
    show(scene, frame - 1);
  });
  next.addEventListener("click", () => {
    if (isDisabled(next)) return;
    stop();
    show(scene, frame + 1);
  });
  play.addEventListener("click", () => {
    if (playing) {
      stop();
      return;
    }
    if (frame >= lastFrame()) show(scene, 0);
    playing = true;
    renderPlay();
    schedule();
  });
  tabs.forEach((tab, index) =>
    tab.addEventListener("click", () => {
      stop();
      show(index, 0);
    }),
  );
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
  });
  new ResizeObserver(() => {
    if (live.offsetWidth === width) return;
    width = live.offsetWidth;
    fitLive();
  }).observe(live);

  show(0, 0, false);
}
