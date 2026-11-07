const words = (value) =>
  value === undefined ? [] : value.split(" ").filter((word) => word !== "");

export const resolveFrame = (frames, index) => {
  const shown = new Set();
  const marks = {};
  const places = {};
  const texts = {};
  frames.slice(0, index + 1).forEach((frame) => {
    words(frame.show).forEach((name) => shown.add(name));
    words(frame.hide).forEach((name) => shown.delete(name));
    Object.assign(marks, frame.mark);
    Object.assign(places, frame.place);
    Object.assign(texts, frame.set);
  });
  return { shown, highlighted: new Set(words(frames[index]?.hi)), marks, places, texts };
};

const dwellMilliseconds = (text) => Math.max(2800, text.length * 120);

const initPlayer = (root) => {
  const scene = root.querySelector ("[data-ax-scene]");
  const controls = root.querySelector ("[data-ax-controls]");
  const progress = root.querySelector ("[data-ax-progress]");
  const button = (name) => root.querySelector (`[data-ax-action="${name}"]`);
  const [restart, back, play, forward] = ["restart", "back", "play", "forward"].map(button);
  if (!scene || !controls || !progress || !restart || !back || !play || !forward) return;

  const elements = new Map(
    [...scene.querySelectorAll ("[data-el]")].map((el) => [el.dataset.el ?? "", el]),
);
  const scenarios = [...root.querySelectorAll ("[data-ax-scenario]")].map((wrapper) => {
    const steps = [...wrapper.querySelectorAll ("[data-frame]")];
    return { wrapper, steps, frames: steps.map((li) => JSON.parse(li.dataset.frame ?? "{}")) };
  });
  const settable = new Set(scenarios.flatMap(({ frames }) => frames.flatMap((frame) => Object.keys(frame.set ?? {}))));
  const defaultTexts = new Map([...settable].map((name) => [name, elements.get(name)?.textContent ?? ""]));
  const tabs = [...root.querySelectorAll ("[data-ax-tab]")];
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  let scenarioIndex = 0;
  let stepIndex = 0;
  let timer ;
  let currentPlaces = {};

  const placeTokens =() => {
    const sceneRect = scene.getBoundingClientRect();
    elements.forEach((el, name) => {
      if (!el.classList.contains("ax-token")) return;
      const anchor = elements.get(currentPlaces[name] ?? "");
      el.toggleAttribute("data-on", anchor !== undefined);
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const x = rect.left - sceneRect.left + rect.width / 2 - el.offsetWidth / 2;
      const y = rect.top - sceneRect.top - el.offsetHeight / 2 + 2;
      const clampedX = Math.max(0, Math.min(x, sceneRect.width - el.offsetWidth));
      el.style.transform = `translate(${clampedX}px, ${y}px)`;
    });
  };

  const render =() => {
    const scenario = scenarios[scenarioIndex];
    if (!scenario) return;
    const frame = resolveFrame(scenario.frames, stepIndex);
    elements.forEach((el, name) => {
      el.toggleAttribute("data-on", frame.shown.has(name));
      el.toggleAttribute("data-hi", frame.highlighted.has(name));
      const mark = frame.marks[name];
      if (mark) el.dataset.mark = mark;
      else delete el.dataset.mark;
      if (settable.has(name)) el.textContent = frame.texts[name] ?? defaultTexts.get(name) ?? "";
    });
    currentPlaces = frame.places;
    placeTokens();
    scenarios.forEach((item, index) => {
      item.wrapper.hidden = index !== scenarioIndex;
    });
    scenario.steps.forEach((li, index) => li.toggleAttribute("data-current", index === stepIndex));
    tabs.forEach((tab, index) => tab.setAttribute("aria-pressed", String(index === scenarioIndex)));
    progress.textContent = `${stepIndex + 1} / ${scenario.steps.length}`;
    restart.disabled = stepIndex === 0;
    back.disabled = stepIndex === 0;
    forward.disabled = stepIndex === scenario.steps.length - 1;
    play.textContent = timer === undefined ? "再生" : "一時停止";
  };

  const stop =() => {
    if (timer !== undefined) window.clearTimeout(timer);
    timer = undefined;
  };

  const schedule =() => {
    const scenario = scenarios[scenarioIndex];
    const text = scenario?.steps[stepIndex]?.textContent ?? "";
    timer = window.setTimeout(() => {
      const last = (scenarios[scenarioIndex]?.steps.length ?? 1) - 1;
      stepIndex = Math.min(stepIndex + 1, last);
      if (stepIndex === last) stop();
      else schedule();
      render();
    }, dwellMilliseconds(text));
  };

  const goTo = (index) => {
    stop();
    stepIndex = index;
    render();
  };

  restart.addEventListener("click",() => goTo(0));
  back.addEventListener("click",() => goTo(Math.max(0, stepIndex - 1)));
  forward.addEventListener("click",() => {
    const last = (scenarios[scenarioIndex]?.steps.length ?? 1) - 1;
    goTo(Math.min(last, stepIndex + 1));
  });
  play.addEventListener("click",() => {
    if (timer !== undefined) {
      stop();
    } else {
      const last = (scenarios[scenarioIndex]?.steps.length ?? 1) - 1;
      if (stepIndex === last) stepIndex = 0;
      schedule();
    }
    render();
  });
  tabs.forEach((tab, index) =>
    tab.addEventListener("click",() => {
      scenarioIndex = index;
      goTo(0);
    }),
);
  document.addEventListener("visibilitychange",() => {
    if (document.hidden && timer !== undefined) {
      stop();
      render();
    }
  });
  const syncMotion =() => {
    if (reducedMotion.matches) stop();
    play.hidden = reducedMotion.matches;
    render();
  };
  reducedMotion.addEventListener("change", syncMotion);
  new ResizeObserver(placeTokens).observe(scene);

  scene.hidden = false;
  controls.hidden = false;
  root.toggleAttribute("data-ax-ready", true);
  syncMotion();
};

export const initAnimatedExplanations =() => {
  document.querySelectorAll ("[data-ax]").forEach(initPlayer);
};
