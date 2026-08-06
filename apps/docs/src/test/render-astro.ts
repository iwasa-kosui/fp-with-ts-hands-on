import { getContainerRenderer as reactContainerRenderer } from "@astrojs/react";
import { loadRenderers } from "astro:container";
import { experimental_AstroContainer as AstroContainer } from "astro/container";

export const createAstroContainer = async (): Promise<AstroContainer> => {
  const container = await AstroContainer.create({
    renderers: await loadRenderers([reactContainerRenderer()]),
  });
  container.addClientRenderer({
    name: "@astrojs/react",
    entrypoint: "@astrojs/react/client.js",
  });
  return container;
};
