import type { ModuleContent } from "./module-content";
import { breakTheAppModule } from "./modules/00-break-the-app";
import { readTheIncidentModule } from "./modules/00-read-the-incident";
import { stateModelingModule } from "./modules/01-state-modeling";
import { boundaryAndIdsModule } from "./modules/02-boundary-and-ids";
import { resultErrorsModule } from "./modules/03-result-errors";
import { agentReviewModule } from "./modules/04-agent-review";
import { miniIntegrationModule } from "./modules/05-mini-integration";

export const modules = [
  breakTheAppModule,
  readTheIncidentModule,
  stateModelingModule,
  boundaryAndIdsModule,
  resultErrorsModule,
  agentReviewModule,
  miniIntegrationModule,
] as const satisfies readonly ModuleContent[];

export const moduleBySlug = (slug: string): ModuleContent | undefined =>
  modules.find((module) => module.slug === slug);

export const moduleNeighbors = (slug: string): {
  previous?: ModuleContent;
  next?: ModuleContent;
} => {
  const index = modules.findIndex((module) => module.slug === slug);
  if (index < 0) return {};
  const previous = modules[index - 1];
  const next = modules[index + 1];
  return {
    ...(previous === undefined ? {} : { previous }),
    ...(next === undefined ? {} : { next }),
  };
};
