import type { ModuleContent } from "../content/module-content";

export const renderModuleCard = (module: ModuleContent): HTMLElement => {
  const card = document.createElement("article");
  card.dataset.moduleCard = "";
  const heading = document.createElement("h2");
  heading.textContent = module.title;
  card.append(heading);
  return card;
};
