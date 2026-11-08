export type PackageJson = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  [key: string]: unknown;
};

export const runtimeToolVersions: Readonly<{ tsx: string; typescript: string }>;

export const chmodBinScript: string;

export const withoutWorkspaceDependencies: (
  dependencies: Record<string, string> | undefined,
) => Record<string, string> | undefined;

export const browserPackageJsonFor: (packageJson: PackageJson) => PackageJson;

export const withRuntimeTools: (
  devDependencies: Record<string, string> | undefined,
) => Record<string, string>;

export const snapshotPackageJsonFor: (
  sourcePackageJson: PackageJson,
  scripts?: Record<string, string>,
) => PackageJson;

export const mergedSnapshotPackageJsonFor: (
  sourcePackageJsons: readonly PackageJson[],
  scripts?: Record<string, string>,
) => PackageJson;

export const snapshotDependenciesOf: (
  packageJson: PackageJson,
) => Record<string, string>;
