import { renderProgress } from "./step-progress";

type Options = Readonly<{
  root: HTMLElement;
  onStep?: (index: number) => void;
}>;

export const mountStepper = ({ root, onStep }: Options): void => {
  if (root.dataset.ready !== undefined) return;
  const panels = [...root.querySelectorAll<HTMLElement>("[data-frame]")];
  const controls = root.querySelector<HTMLElement>("[data-controls]");
  const prev = root.querySelector<HTMLButtonElement>("[data-prev]");
  const next = root.querySelector<HTMLButtonElement>("[data-next]");
  const progress = root.querySelector<HTMLElement>("[data-progress]");
  if (!controls || !prev || !next || !progress || panels.length === 0) return;

  const last = panels.length - 1;
  let current = 0;

  const show = (index: number) => {
    current = index;
    root.dataset.step = String(index);
    panels.forEach((panel, panelIndex) => {
      panel.hidden = panelIndex !== index;
    });
    renderProgress(progress, index, panels.length);
    prev.disabled = index === 0;
    next.disabled = index === last;
    onStep?.(index);
  };

  prev.addEventListener("click", () => show(Math.max(current - 1, 0)));
  next.addEventListener("click", () => show(Math.min(current + 1, last)));

  root.dataset.ready = "";
  controls.hidden = false;
  const measureControls = () => {
    root.style.setProperty("--step-controls-w", `${controls.offsetWidth}px`);
    root.style.setProperty("--step-controls-h", `${controls.offsetHeight}px`);
  };
  measureControls();
  if (typeof ResizeObserver !== "undefined") new ResizeObserver(measureControls).observe(controls);
  show(0);

  const stage = root.matches(".sf") ? root.querySelector<HTMLElement>(".sf-stage") : null;
  if (stage !== null && typeof ResizeObserver !== "undefined") {
    const narrow = matchMedia("(max-width: 900px)");
    let width = 0;
    const fitStage = () => {
      stage.style.minHeight = "";
      if (!narrow.matches) return;
      const shown = current;
      const regions = [...root.querySelectorAll("[aria-live]")];
      regions.forEach((region) => region.setAttribute("aria-live", "off"));
      let tallest = 0;
      for (let index = 0; index <= last; index += 1) {
        show(index);
        tallest = Math.max(tallest, stage.getBoundingClientRect().height);
      }
      show(shown);
      regions.forEach((region) => region.setAttribute("aria-live", "polite"));
      stage.style.minHeight = `${Math.ceil(tallest)}px`;
    };
    new ResizeObserver(() => {
      if (stage.offsetWidth === width) return;
      width = stage.offsetWidth;
      fitStage();
    }).observe(stage);
    narrow.addEventListener("change", fitStage);
  }
};
