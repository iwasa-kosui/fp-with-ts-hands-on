type ProjectFiles = Readonly<Record<string, string>>;

const workspaceUrl = "file:///workspace/";

const alwaysDeclared = ["@fp-with-ts/clinic-web"];

const declarePackage = (name: string): readonly string[] => [
  `declare module "${name}";`,
  `declare module "${name}/*";`,
];

const fixedDeclarations = [
  ...alwaysDeclared.flatMap(declarePackage),
  'declare module "node:*";',
];

const dependencyNames = (value: unknown): readonly string[] =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? Object.keys(value)
    : [];

const declaredPackageNames = (source: string | undefined): readonly string[] => {
  if (source === undefined) return [];
  try {
    const parsed: unknown = JSON.parse(source);
    if (typeof parsed !== "object" || parsed === null) return [];
    const manifest = parsed as Record<string, unknown>;
    return [
      ...dependencyNames(manifest["dependencies"]),
      ...dependencyNames(manifest["devDependencies"]),
    ];
  } catch {
    return [];
  }
};

export const buildAmbientModules = (
  files: ProjectFiles,
  typeFiles: ProjectFiles,
): string => {
  const typedPackageManifests = new Set(
    Object.keys(typeFiles).map((path) =>
      path.startsWith(workspaceUrl) ? path.slice(workspaceUrl.length) : path,
    ),
  );
  const names = [...new Set(declaredPackageNames(files["package.json"]))].filter(
    (name) =>
      !alwaysDeclared.includes(name) &&
      !typedPackageManifests.has(`node_modules/${name}/package.json`),
  );

  return [...names.flatMap(declarePackage), ...fixedDeclarations, ""].join("\n");
};
