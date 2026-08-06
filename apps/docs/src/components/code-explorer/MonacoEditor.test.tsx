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
        onChange={() => undefined}
      />,
    );
    expect(html).toContain("src/clinic/appointment.ts");
    expect(html).toContain("export const kind");
  });

  it("uses absolute file URIs for project-relative paths", () => {
    expect(modelUriFor("src/clinic/appointment.ts")).toBe(
      "file:///src/clinic/appointment.ts",
    );
  });
});
