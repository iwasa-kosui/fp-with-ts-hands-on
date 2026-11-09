import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CaseList } from "./CaseList";
import type { DisplayRow } from "./labels";

const row = (id: string, behavior?: DisplayRow["behavior"]): DisplayRow => ({
  id,
  kind: "bad",
  title: `題名 ${id}`,
  required: true,
  hint: "",
  cells: undefined,
  verdict: undefined,
  ...(behavior === undefined ? {} : { behavior }),
});

const render = (
  rows: readonly DisplayRow[],
  showPeerNote = true,
): Document => {
  const document = new DOMParser().parseFromString(
    renderToStaticMarkup(
      <CaseList
        rows={rows}
        casePath={(id) => `exercises/guard/cases/${id}.ts`}
        selectedPath={undefined}
        disabled={false}
        showPeerNote={showPeerNote}
        onSelect={() => undefined}
      />,
    ),
    "text/html",
  );
  return document;
};

describe("CaseList behavior", () => {
  it("shows input, expected, and actual under the title of a row with behavior", () => {
    const document = render([
      row("B1", {
        input: { text: "年齢", value: "20" },
        expected: { text: "受け付ける", value: "ok" },
        actual: { text: "拒否する" },
      }),
    ]);
    const button = document.querySelector('button[data-case-id="B1"]');

    expect(button?.querySelector(".guard-exercise__behavior")?.textContent).toBe(
      "入力年齢20本来受け付けるokこの変更では拒否する",
    );
    expect(
      button?.querySelector('[data-side="expected"] code')?.textContent,
    ).toBe("ok");
    expect(button?.querySelector('[data-side="actual"] code')).toBeNull();
    expect(button?.querySelectorAll("div, p, dl")).toHaveLength(0);
    expect(button?.querySelector(".guard-exercise__case-title")?.textContent).toBe(
      "題名 B1",
    );
  });

  it("keeps a row without behavior as the title and the mark only", () => {
    const document = render([row("B2")]);
    const button = document.querySelector('button[data-case-id="B2"]');

    expect(button?.querySelector(".guard-exercise__behavior")).toBeNull();
    expect(button?.textContent).toBe("題名 B2未確認");
  });

  it("renders only the list of bad changes, without the guide", () => {
    const document = render([row("B3")]);

    expect(document.querySelector("h2")).toBeNull();
    expect(document.querySelector("ol, .guard-exercise__steps")).toBeNull();
    expect(document.querySelector(".guard-exercise__criteria")).toBeNull();
    expect(document.querySelector(".guard-exercise__guide")).toBeNull();
    expect(document.querySelector("h3")?.textContent).toBe("誤った変更");
  });
});

describe("CaseList groups", () => {
  const optional = { ...row("B4"), required: false, verdict: "slipped" as const };
  const peer = { ...row("R1-peer-change"), required: false, verdict: "unchanged" as const };
  const headings = (document: Document) =>
    [...document.querySelectorAll("h4")].map((heading) => heading.textContent);

  it("shows no group heading when there is no optional row and no peer review row", () => {
    expect(headings(render([row("B5"), row("B6")]))).toEqual([]);
  });

  it("divides the list under the three headings of the table", () => {
    const document = render([row("B5"), optional, peer]);

    expect(headings(document)).toEqual([
      "必須の誤った変更",
      "任意の誤った変更（時間に余裕がある場合に取り組みます）",
      "相互レビューで使う行",
    ]);
    expect(
      document.querySelector('button[data-case-id="B4"]')?.getAttribute("data-group"),
    ).toBe("optional");
  });

  it("omits the headings of groups that have no row", () => {
    expect(headings(render([row("B5"), optional]))).toEqual([
      "必須の誤った変更",
      "任意の誤った変更（時間に余裕がある場合に取り組みます）",
    ]);
  });

  it("shows the note about the next page under an unchanged peer review row on the exercise page", () => {
    const item = render([row("B5"), peer]).querySelector(
      'li:has([data-case-id="R1-peer-change"])',
    );

    expect(item?.querySelector(".guard-exercise__peer-note")?.textContent).toBe(
      "次のページの相互レビューで使います。この演習での操作は不要です。",
    );
  });

  it("omits the note on the peer review page and once the row has changed", () => {
    expect(
      render([row("B5"), peer], false).querySelector(".guard-exercise__peer-note"),
    ).toBeNull();
    expect(
      render([row("B5"), { ...peer, verdict: "slipped" }]).querySelector(
        ".guard-exercise__peer-note",
      ),
    ).toBeNull();
  });
});
