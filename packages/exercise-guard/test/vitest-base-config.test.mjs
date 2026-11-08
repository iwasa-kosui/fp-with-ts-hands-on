import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { judge } from "../src/judge.mjs";
import { buildVitestConfig } from "../src/tests.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "alias-root");

describe("vitestBaseConfig", () => {
  it("生成する設定は、基の設定の resolve だけを取り入れる", () => {
    const text = buildVitestConfig({
      root: "/project",
      workDir: "/project/dist/guard",
      isolate: true,
      baseConfigFile: "/project/vitest.base.config.mjs",
    });

    expect(text).toContain('import base from "/project/vitest.base.config.mjs";');
    expect(text).toContain("resolved.resolve");
    expect(text).not.toContain("resolved.test");
    expect(buildVitestConfig({ root: "/project", workDir: "/project/dist/guard", isolate: true, baseConfigFile: undefined })).not.toContain("import base");
  });

  it("alias を使う題材のテストが、基の設定の resolve で動く", async () => {
    const result = await judge({ root, workDir: "dist/guard" });

    expect(result.problems).toEqual([]);
    expect(result.rows.find((row) => row.id === "B1-wrong")?.verdict).toBe("detected");
    expect(result.rows.find((row) => row.id === "G1-right")?.verdict).toBe("noFalsePositive");
    expect(result.passed).toBe(true);
  });
});
