import { renderProgress } from "../stepper/step-progress";

const roots = document.querySelectorAll("[data-walk]:not([data-walk-ready])");
const reduced = matchMedia("(prefers-reduced-motion: reduce)");

for (const root of roots) {
  root.setAttribute("data-walk-ready", "");

  const sceneEls = [...root.querySelectorAll("[data-walk-scene]")];
  const items = sceneEls.map((el) => [...el.querySelectorAll("li")]);
  const tabs = [...root.querySelectorAll("[data-walk-tab]")];
  const live = root.querySelector("[data-walk-live]");
  const sticky = root.querySelector(".walk__sticky");
  const controls = root.querySelector("[data-controls]");
  const progress = root.querySelector("[data-progress]");
  const page = root.hasAttribute("data-walk-page");
  const prev = root.querySelector("[data-prev]");
  const next = root.querySelector("[data-next]");

  let scene = 0;
  let frame = 0;
  let width = 0;
  let revealToken = 0;

  const lastFrame = () => items[scene].length - 1;

  const fitLive = () => {
    if (live.offsetWidth === 0) return;
    const probe = live.cloneNode(false);
    probe.removeAttribute("aria-live");
    probe.removeAttribute("data-walk-live");
    probe.setAttribute("aria-hidden", "true");
    probe.style.cssText = `position:absolute;visibility:hidden;pointer-events:none;min-height:0;width:${live.offsetWidth}px`;
    live.after(probe);
    let tallest = 0;
    for (const li of items.flat()) {
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
    renderProgress(progress, frame, items[scene].length);
    if (sceneChanged && !page) fitLive();
    live.innerHTML = items[scene][frame].innerHTML;
    prev.disabled = frame === 0;
    next.disabled = frame >= lastFrame();
    root.dispatchEvent(new CustomEvent("stepchange", { detail: { scene, frame } }));
    if (follow && !page) reveal();
  };

  prev.addEventListener("click", () => show(scene, frame - 1));
  next.addEventListener("click", () => show(scene, frame + 1));
  tabs.forEach((tab, index) => tab.addEventListener("click", () => show(index, 0)));
  new ResizeObserver(() => {
    if (live.offsetWidth === width) return;
    width = live.offsetWidth;
    fitLive();
  }).observe(live);

  controls.hidden = false;
  show(0, 0, false);
}
