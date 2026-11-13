import { renderProgress } from "./stepper/step-progress";

const setUp = (root) => {
  const { scenarios } = JSON.parse(
    root.querySelector("[data-player-data]")?.textContent ?? "{}",
  );
  const need = (selector) => {
    const element = root.querySelector(selector);
    if (element === null) throw new Error(`${selector} is missing`);
    return element;
  };
  const token = need("[data-token]");
  const track = need("[data-track]");
  const statusBox = need("[data-status-box]");
  const valueLabel = need("[data-value-label]");
  const values = [...root.querySelectorAll("[data-value-text]")];
  const text = need("[data-text]");
  const controls = need("[data-controls]");
  const progress = need("[data-progress]");
  const prev = need("[data-prev]");
  const next = need("[data-next]");
  const scenarioButtons = [...root.querySelectorAll("[data-scenario]")];
  const files = [...root.querySelectorAll("[data-file]")];
  const miniFiles = [...root.querySelectorAll("[data-mini-file]")];

  const codeOf = new Map(
    files.map((file) => [
      file,
      { code: file.querySelector("pre code"), lines: [...file.querySelectorAll(".line")] },
    ]),
  );

  const fold = () => {
    const mark = document.createElement("span");
    mark.className = "boundary-player__fold";
    mark.setAttribute("aria-hidden", "true");
    mark.textContent = "…";
    return mark;
  };

  const rangeOf = (frame, total, rows) => {
    const count = frame.to - frame.from + 1;
    for (let size = rows; size >= count; size -= 1) {
      const extra = size - count;
      const roomAfter = total - 1 - frame.to;
      const before = Math.min(frame.from, Math.floor(extra * 0.3));
      const after = Math.min(roomAfter, extra - before);
      const first = frame.from - Math.min(frame.from, extra - after);
      const last = frame.to + after;
      const folds = (first > 0 ? 1 : 0) + (last < total - 1 ? 1 : 0);
      if (last - first + 1 + folds <= rows) return [first, last];
    }
    return [frame.from, frame.to];
  };

  const showWindow = ({ code, lines }, frame) => {
    const pre = code?.parentElement;
    if (!code || !pre) return;
    const style = getComputedStyle(pre);
    const lineHeight = Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize) * 1.45;
    const inner = pre.clientHeight - Number.parseFloat(style.paddingTop) - Number.parseFloat(style.paddingBottom);
    const count = frame.to - frame.from + 1;
    for (let rows = Math.max(1, Math.floor(inner / lineHeight)); rows >= count; rows -= 1) {
      const [first, last] = rangeOf(frame, lines.length, rows);
      const items = [
        ...(first > 0 ? [fold()] : []),
        ...lines.slice(first, last + 1),
        ...(last < lines.length - 1 ? [fold()] : []),
      ];
      code.replaceChildren(
        ...items.flatMap((item, index) => (index === 0 ? [item] : [document.createTextNode("\n"), item])),
      );
      if (pre.scrollHeight <= pre.clientHeight + 1) break;
    }
    pre.scrollTop = 0;
  };

  let scenario = scenarios[0];
  let index = 0;

  const render = () => {
    const frame = scenario?.frames[index];
    if (scenario === undefined || frame === undefined) return;
    scenarioButtons.forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.scenario === scenario?.id));
    });
    track.dataset.status = frame.status;
    track.dataset.zone = String(frame.zone);
    token.style.setProperty("--token-position", `${frame.zone * 33.333 + 16.667}%`);
    token.textContent = frame.status === "stop" ? "✕" : "値";
    statusBox.dataset.status = frame.status;
    valueLabel.textContent = frame.valueLabel;
    for (const value of values) value.hidden = value.dataset.valueText !== frame.value;
    text.textContent = frame.text;
    renderProgress(progress, index, scenario.frames.length);
    prev.disabled = index === 0;
    next.disabled = index === scenario.frames.length - 1;

    for (const miniFile of miniFiles) {
      if (miniFile.dataset.miniFile === frame.fileId) {
        miniFile.setAttribute("data-current", "");
        miniFile.setAttribute("aria-current", "true");
      } else {
        miniFile.removeAttribute("data-current");
        miniFile.removeAttribute("aria-current");
      }
    }

    for (const file of files) {
      const active = file.dataset.file === frame.fileId;
      file.toggleAttribute("data-current", active);
      file.inert = !active;
      const shown = codeOf.get(file);
      if (shown === undefined) continue;
      shown.lines.forEach((line, lineIndex) => {
        line.classList.toggle(
          "is-active",
          active && lineIndex >= frame.from && lineIndex <= frame.to,
        );
      });
      if (active) showWindow(shown, frame);
    }
  };

  prev.addEventListener("click", () => {
    index = Math.max(0, index - 1);
    render();
  });
  next.addEventListener("click", () => {
    index = Math.min((scenario?.frames.length ?? 1) - 1, index + 1);
    render();
  });
  scenarioButtons.forEach((button) => {
    button.addEventListener("click", () => {
      scenario = scenarios.find(({ id }) => id === button.dataset.scenario) ?? scenario;
      index = 0;
      render();
    });
  });

  window.addEventListener("resize", () => render());

  root.dataset.ready = "true";
  controls.hidden = false;
  render();
};

document.querySelectorAll("[data-boundary-player]:not([data-ready])").forEach(setUp);
