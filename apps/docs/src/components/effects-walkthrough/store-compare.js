const figures = document.querySelectorAll("[data-store-compare]:not([data-sc-ready])");

for (const figure of figures) {
  figure.setAttribute("data-sc-ready", "");
  const root = figure.closest("[data-walk]");
  const panes = [...figure.querySelectorAll("[data-pane]")];

  const apply = () => {
    const frame = Number(root.dataset.frame) || 0;
    for (const pane of panes) {
      const active = Number(pane.dataset.pane) === frame;
      const marked = new Set(active ? JSON.parse(pane.dataset.lines) : []);
      const code = pane.querySelector("pre code");
      pane.toggleAttribute("data-active", active);
      code.toggleAttribute("data-has-active", marked.size > 0);
      [...code.children].forEach((line, index) => line.classList.toggle("is-active", marked.has(index)));
    }
  };

  root.addEventListener("stepchange", apply);
  apply();
}
