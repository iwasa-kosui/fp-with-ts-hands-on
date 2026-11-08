export const runtimeToolVersions = Object.freeze({
  tsx: "4.23.9",
  typescript: "5.9.3",
});

export const chmodBinScript = `const fs = require("node:fs");
const directory = "node_modules/.bin";
if (fs.existsSync(directory)) {
  for (const name of fs.readdirSync(directory)) {
    try {
      fs.chmodSync(directory + "/" + name, 0o755);
    } catch {}
  }
}`;

export const withoutWorkspaceDependencies = (dependencies) =>
  dependencies === undefined
    ? undefined
    : Object.fromEntries(
        Object.entries(dependencies).filter(
          ([, version]) => !version.startsWith("workspace:"),
        ),
      );

export const browserPackageJsonFor = (packageJson) => ({
  ...packageJson,
  dependencies: withoutWorkspaceDependencies(packageJson.dependencies),
  devDependencies: withoutWorkspaceDependencies(packageJson.devDependencies),
  optionalDependencies: withoutWorkspaceDependencies(
    packageJson.optionalDependencies,
  ),
  peerDependencies: withoutWorkspaceDependencies(packageJson.peerDependencies),
});

export const withRuntimeTools = (devDependencies) => ({
  ...devDependencies,
  ...runtimeToolVersions,
});

export const snapshotPackageJsonFor = (sourcePackageJson, scripts = {}) => {
  const browser = browserPackageJsonFor(sourcePackageJson);
  return {
    ...browser,
    scripts: { ...browser.scripts, ...scripts },
    devDependencies: withRuntimeTools(browser.devDependencies),
  };
};

const mergeDependencyGroups = (groups) => {
  const merged = {};
  for (const group of groups) {
    for (const [name, range] of Object.entries(group ?? {})) {
      if (merged[name] !== undefined && merged[name] !== range) {
        throw new Error(
          `Dependency ${name} has conflicting ranges: ${merged[name]} and ${range}`,
        );
      }
      merged[name] = range;
    }
  }
  return merged;
};

export const mergedSnapshotPackageJsonFor = (
  sourcePackageJsons,
  scripts = {},
) => {
  const browsers = sourcePackageJsons.map(browserPackageJsonFor);
  const base = browsers[browsers.length - 1];
  const dependencies = mergeDependencyGroups(
    browsers.map((browser) => browser.dependencies),
  );
  const devDependencies = mergeDependencyGroups(
    browsers.map((browser) => browser.devDependencies),
  );
  mergeDependencyGroups([dependencies, devDependencies]);
  return {
    ...base,
    scripts: { ...base.scripts, ...scripts },
    dependencies,
    devDependencies: withRuntimeTools(devDependencies),
  };
};

export const snapshotDependenciesOf = (packageJson) => ({
  ...packageJson.dependencies,
  ...packageJson.devDependencies,
});
