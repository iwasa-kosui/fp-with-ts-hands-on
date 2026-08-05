import type { ModuleContent } from "../content/module-content";
import { modulePath } from "../routes";

export const renderModuleCard = (module: ModuleContent): HTMLElement => {
  const card = document.createElement("article");
  card.dataset.moduleCard = "";

  const link = document.createElement("a");
  link.href = modulePath(module);

  const marker = document.createElement("span");
  marker.className = "module-card-marker";
  marker.ariaHidden = "true";
  marker.textContent = module.caseStudy.avatar;

  const heading = document.createElement("h2");
  heading.textContent = module.title;

  const meta = document.createElement("p");
  meta.textContent = `${module.label} · ${module.durationMinutes}分`;

  const mission = document.createElement("p");
  mission.textContent = module.mission;

  link.append(marker, heading, meta, mission);
  card.append(link);
  return card;
};
