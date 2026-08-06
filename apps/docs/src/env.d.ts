/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

declare var MonacoEnvironment: {
  getWorker: (moduleId: string, label: string) => Worker;
};
