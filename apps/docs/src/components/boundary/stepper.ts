type Options = Readonly<{
  root: HTMLElement;
  onStep?: (index: number) => void;
  intervalMs?: number;
}>;

export const mountStepper = ({ root, onStep, intervalMs = 6000 }: Options): void => {
  if (root.dataset.ready !== undefined) return;
  const panels = [...root.querySelectorAll<HTMLElement>("[data-frame]")];
  const controls = root.querySelector<HTMLElement>("[data-controls]");
  const prev = root.querySelector<HTMLButtonElement>("[data-prev]");
  const play = root.querySelector<HTMLButtonElement>("[data-play]");
  const next = root.querySelector<HTMLButtonElement>("[data-next]");
  const progress = root.querySelector<HTMLElement>("[data-progress]");
  if (!controls || !prev || !play || !next || !progress || panels.length === 0) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const last = panels.length - 1;
  let current = 0;
  let timer: number | undefined;

  const stop = () => {
    if (timer !== undefined) window.clearInterval(timer);
    timer = undefined;
    play.textContent = "▶ 再生";
  };

  const show = (index: number) => {
    current = index;
    root.dataset.step = String(index);
    panels.forEach((panel, panelIndex) => {
      panel.hidden = panelIndex !== index;
    });
    progress.textContent = `${index + 1} / ${panels.length}`;
    prev.disabled = index === 0;
    next.disabled = index === last;
    onStep?.(index);
  };

  const start = () => {
    play.textContent = "❚❚ 一時停止";
    timer = window.setInterval(() => {
      show(Math.min(current + 1, last));
      if (current === last) stop();
    }, intervalMs);
  };

  play.addEventListener("click", () => {
    if (timer !== undefined) {
      stop();
      return;
    }
    if (current === last) show(0);
    start();
  });
  prev.addEventListener("click", () => {
    stop();
    show(Math.max(current - 1, 0));
  });
  next.addEventListener("click", () => {
    stop();
    show(Math.min(current + 1, last));
  });

  const applyMotion = () => {
    play.hidden = reducedMotion.matches;
    if (reducedMotion.matches) stop();
  };
  reducedMotion.addEventListener("change", applyMotion);
  applyMotion();

  root.dataset.ready = "";
  controls.hidden = false;
  show(0);
};
