export type ProjectFiles = Readonly<Record<string, string>>;

export type ModuleWorkspace = Readonly<{
  slug: string;
  description: string;
  initialFile: string;
  visibleFiles: readonly string[];
}>;
