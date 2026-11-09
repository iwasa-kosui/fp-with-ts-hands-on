import { mountStepper } from "../stepper/stepper";

type Lit = Readonly<Record<string, readonly number[]>>;

export const mountLitFigure = (
  root: HTMLElement,
  onStep?: (index: number) => void,
): void => {
  const frames = JSON.parse(root.dataset.lit ?? "[]") as readonly Lit[];
  const panels = [...root.querySelectorAll<HTMLElement>("[data-code]")];

  mountStepper({
    root,
    onStep: (index) => {
      const lit = frames[index] ?? {};
      panels.forEach((panel) => {
        const marked = lit[panel.dataset.code ?? ""] ?? [];
        panel.querySelectorAll("code").forEach((code) => code.toggleAttribute("data-lit", marked.length > 0));
        panel.querySelectorAll(".line").forEach((line, lineIndex) => {
          line.classList.toggle("is-lit", marked.includes(lineIndex));
        });
      });
      onStep?.(index);
    },
  });
};
