import type { ModuleContent } from "../content/modules";

export const renderModuleCard = (module: ModuleContent): HTMLElement => {
  const article = document.createElement("article");
  article.className = "module-card";

  const marker = document.createElement("span");
  marker.className = `animal-marker animal-marker--${module.animal}`;
  marker.textContent = module.animalLabel;
  marker.setAttribute("aria-hidden", "true");

  const content = document.createElement("div");
  const meta = document.createElement("p");
  meta.className = "module-card__meta";
  meta.textContent = `${module.id} / ${module.minutes} min`;
  const title = document.createElement("h3");
  title.textContent = module.title;
  const goal = document.createElement("p");
  goal.textContent = module.doneWhen;
  content.append(meta, title, goal);

  article.append(marker, content);
  return article;
};
