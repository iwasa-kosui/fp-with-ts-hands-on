import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MonacoEditor, modelUriFor } from "./MonacoEditor";

describe("MonacoEditor", () => {
  it("renders readable source before browser hydration", () => {
    const html = renderToString(
      <MonacoEditor
        path="src/clinic/appointment.ts"
        value={'export const kind = "Scheduled";'}
        files={{
          "src/clinic/appointment.ts": 'export const kind = "Scheduled";',
        }}
        typeFiles={{}}
        disabled={false}
        readOnly={false}
        highlights={[]}
        onChange={() => undefined}
      />,
    );
    expect(html).toContain("src/clinic/appointment.ts");
    expect(html).toContain("export const kind");
  });

  it("marks highlighted fallback lines before browser hydration", () => {
    const html = renderToString(
      <MonacoEditor
        path="src/example.ts"
        value={'const safe = true;\nconst status: string = "scheduled";'}
        files={{
          "src/example.ts":
            'const safe = true;\nconst status: string = "scheduled";',
        }}
        typeFiles={{}}
        disabled={false}
        readOnly={true}
        highlights={[{ startLineNumber: 2, endLineNumber: 2 }]}
        onChange={() => undefined}
      />,
    );

    expect(html).toContain('data-line="2"');
    expect(html).toContain("code-explorer__source-line--highlighted");
    expect(html).toContain("const status: string");
  });

  it("uses absolute file URIs for project-relative paths", () => {
    expect(modelUriFor("src/clinic/appointment.ts")).toBe(
      "file:///src/clinic/appointment.ts",
    );
  });
});
