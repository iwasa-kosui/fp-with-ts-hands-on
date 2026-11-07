export const nextStep = (stepIndex, stepCount) => Math.min(stepIndex + 1, stepCount - 1);

export const previousStep = (stepIndex) => Math.max(stepIndex - 1, 0);

const dwellMilliseconds = (text) => Math.max(2800, text.length * 120);

const initPlayer = (root) => {
  if (root.hasAttribute("data-step-player-ready")) return;
  const action = (name) => root.querySelector(`[data-step-player-action="${name}"]`);
  const scene = root.querySelector("[data-step-player-scene]");
  const controls = root.querySelector("[data-step-player-controls]");
  const progress = root.querySelector("[data-step-player-progress]");
  const [restart, back, play, forward] = ["restart", "back", "play", "forward"].map(action);
  const tabs = [...root.querySelectorAll("[data-step-player-tab]")];
  const scenarios = [...root.querySelectorAll("[data-step-player-scenario]")].map((wrapper) => ({
    wrapper,
    steps: [...wrapper.querySelectorAll("li")],
  }));
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  let scenarioIndex = 0;
  let stepIndex = 0;
  let timer;

  const stepCount = () => scenarios[scenarioIndex].steps.length;

  const render = () => {
    scenarios.forEach(({ wrapper, steps }, index) => {
      wrapper.hidden = index !== scenarioIndex;
      steps.forEach((li, liIndex) =>
        li.toggleAttribute("data-current", index === scenarioIndex && liIndex === stepIndex),
      );
    });
    tabs.forEach((tab, index) => tab.setAttribute("aria-pressed", String(index === scenarioIndex)));
    progress.textContent = `${stepIndex + 1} / ${stepCount()}`;
    restart.disabled = stepIndex === 0;
    back.disabled = stepIndex === 0;
    forward.disabled = stepIndex === stepCount() - 1;
    play.textContent = timer === undefined ? "再生" : "一時停止";
    root.dispatchEvent(new CustomEvent("stepchange", { detail: { scenarioIndex, stepIndex } }));
  };

  const stop = () => {
    if (timer !== undefined) window.clearTimeout(timer);
    timer = undefined;
  };

  const schedule = () => {
    const li = scenarios[scenarioIndex].steps[stepIndex];
    const extra = li.querySelector("[data-step-extra]")?.textContent ?? "";
    const text = (li.textContent ?? "").slice(0, -extra.length || undefined);
    timer = window.setTimeout(() => {
      stepIndex = nextStep(stepIndex, stepCount());
      if (stepIndex === stepCount() - 1) stop();
      else schedule();
      render();
    }, dwellMilliseconds(text));
  };

  const goTo = (index) => {
    stop();
    stepIndex = index;
    render();
  };

  restart.addEventListener("click", () => goTo(0));
  back.addEventListener("click", () => goTo(previousStep(stepIndex)));
  forward.addEventListener("click", () => goTo(nextStep(stepIndex, stepCount())));
  play.addEventListener("click", () => {
    if (timer !== undefined) {
      stop();
    } else if (stepIndex === stepCount() - 1) {
      stepIndex = 0;
      schedule();
    } else {
      stepIndex = nextStep(stepIndex, stepCount());
      if (stepIndex !== stepCount() - 1) schedule();
    }
    render();
  });
  tabs.forEach((tab, index) =>
    tab.addEventListener("click", () => {
      scenarioIndex = index;
      goTo(0);
    }),
  );
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && timer !== undefined) {
      stop();
      render();
    }
  });
  const syncMotion = () => {
    if (reducedMotion.matches) stop();
    play.hidden = reducedMotion.matches;
    render();
  };
  reducedMotion.addEventListener("change", syncMotion);

  scene.hidden = false;
  controls.hidden = false;
  root.toggleAttribute("data-step-player-ready", true);
  syncMotion();
};

export const initStepPlayers = () => {
  document.querySelectorAll("[data-step-player]").forEach(initPlayer);
};
