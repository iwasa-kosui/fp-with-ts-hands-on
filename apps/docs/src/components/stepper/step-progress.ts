export const renderProgress = (progress: HTMLElement, index: number, total: number): void => {
  const bar = document.createElement("span");
  bar.className = "step-progress__bar";
  bar.setAttribute("aria-hidden", "true");
  for (let i = 0; i < total; i += 1) {
    const seg = document.createElement("span");
    seg.className = "step-progress__seg";
    if (i <= index) seg.setAttribute("data-on", "");
    bar.append(seg);
  }
  const count = document.createElement("span");
  count.className = "step-progress__count";
  count.textContent = `${index + 1} / ${total}`;
  progress.replaceChildren(bar, count);
};
