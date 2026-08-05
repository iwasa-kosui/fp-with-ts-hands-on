import type { ModuleContent } from "./content/module-content";
import { moduleBySlug } from "./content/modules";

export type Route =
  | Readonly<{ kind: "home"; canonicalPath: "/" }>
  | Readonly<{ kind: "module"; canonicalPath: string; module: ModuleContent }>
  | Readonly<{ kind: "not-found"; pathname: string }>;

export const normalizePathname = (pathname: string): string => {
  if (pathname === "/") return "/";
  return `/${pathname.split("/").filter(Boolean).join("/")}/`;
};

export const modulePath = (module: ModuleContent): string => `/modules/${module.slug}/`;

export const resolveRoute = (pathname: string): Route => {
  const normalized = normalizePathname(pathname);
  if (normalized === "/") return { kind: "home", canonicalPath: "/" };

  if (normalized === "/module-00/") {
    const module = moduleBySlug("00-break-the-app");
    if (module !== undefined) {
      return { kind: "module", canonicalPath: modulePath(module), module };
    }
  }

  const match = /^\/modules\/([^/]+)\/$/.exec(normalized);
  const module = match?.[1] === undefined ? undefined : moduleBySlug(match[1]);

  return module === undefined
    ? { kind: "not-found", pathname: normalized }
    : { kind: "module", canonicalPath: modulePath(module), module };
};
