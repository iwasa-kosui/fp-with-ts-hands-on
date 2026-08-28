import { readdir, readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

type PackageJson = Readonly<{
  name?: string;
  scripts?: Readonly<Record<string, string>>;
}>;

const rootUrl = new URL("../../../", import.meta.url);

const readJson = async (url: URL): Promise<PackageJson> =>
  JSON.parse(await readFile(url, "utf8")) as PackageJson;

describe("runnable session package contract", () => {
  it("discovers all eight sessions with runnable package scripts", async () => {
    const examplesUrl = new URL("examples/", rootUrl);
    const sessionDirectories = (await readdir(examplesUrl, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() && /^session-\d{2}$/.test(entry.name))
      .map(({ name }) => name)
      .sort();

    expect(sessionDirectories).toEqual([
      "session-00",
      "session-01",
      "session-02",
      "session-03",
      "session-04",
      "session-05",
      "session-06",
      "session-07",
    ]);

    for (const directory of sessionDirectories) {
      const packageJson = await readJson(new URL(`${directory}/package.json`, examplesUrl));
      expect(packageJson.name, directory).toBe(`@fp-with-ts/clinic-${directory}`);
      expect(Object.keys(packageJson.scripts ?? {}), directory).toEqual(
        expect.arrayContaining(["dev", "build", "typecheck", "test"]),
      );
    }
  });

  it("connects every demo and shared Web package to root commands", async () => {
    const packageJson = await readJson(new URL("package.json", rootUrl));

    for (const session of ["00", "01", "02", "03", "04", "05", "06", "07"]) {
      expect(packageJson.scripts, `demo:${session}`).toHaveProperty(`demo:${session}`);
    }
    for (const command of ["build", "test", "typecheck"]) {
      expect(packageJson.scripts?.[command], command).toContain("./examples/session-*");
      expect(packageJson.scripts?.[command], command).toContain("@fp-with-ts/clinic-web");
    }
  });
});
