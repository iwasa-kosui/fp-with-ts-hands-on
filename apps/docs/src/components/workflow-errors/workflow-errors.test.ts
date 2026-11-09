import { describe, expect, it } from "vitest";

import depsThenInput from "../DepsThenInputFlow.astro?raw";
import exceptionOrResult from "../ExceptionOrResultAnimation.astro?raw";
import { mapFlowCode, andThenFlowCode } from "./examples";
import {
  checkBands,
  dedent,
  excerptBetween,
  lineAll,
  lineIndex,
  lineIs,
  lineRange,
  lineSlice,
} from "./lines";
import { applyMark } from "./lit";
import {
  errorTypes,
  ensureCheckedIn,
  ensureFound,
  isErrPipeline,
  matchCall,
  noticeMessage,
  noticeSwitch,
  noticeTable,
  onErrorLine,
  pipelineBody,
  pipelineFull,
  routeAfter,
  routeBefore,
  routeCatch,
  throwInvalidState,
  throwNotFound,
  throwPersistence,
  useCaseBody,
} from "./sources";
import figureCss from "./figure.css?raw";

const figureNames = [
  "RouteToUseCase.astro",
  "CatchConfluence.astro",
  "FailureKinds.astro",
  "MapFlow.astro",
  "AndThenFlow.astro",
  "RewriteByStep.astro",
  "NoticeMapping.astro",
  "ResultBox.astro",
] as const;

const allComponents = import.meta.glob<string>("./*.astro", {
  query: "?raw",
  import: "default",
  eager: true,
});

const components = Object.fromEntries(
  Object.entries(allComponents).filter(([path]) =>
    figureNames.some((name) => path === `./${name}`),
  ),
);

describe("行の検索", () => {
  const code = ["a(", "  b,", ")", "c(", "  b,", ")"].join("\n");

  it("一意に見つかる行の番号を返す", () => {
    expect(lineIndex(code, "a(")).toBe(0);
    expect(lineIs(code, "c(")).toBe(3);
  });

  it("複数見つかるか、見つからないと例外を投げる", () => {
    expect(() => lineIndex(code, "b,")).toThrow();
    expect(() => lineIndex(code, "zzz")).toThrow();
    expect(lineAll(code, "b,")).toEqual([1, 4]);
  });

  it("開始行から、最初に末尾の文字列を含む行までの番号を返す", () => {
    expect(lineRange(code, "c(", ")")).toEqual([3, 4, 5]);
  });

  it("コードの範囲外の行は強調できない", () => {
    expect(() => checkBands(code, { a: [6] })).toThrow();
    expect(checkBands(code, { a: [5] })).toEqual({ a: [5] });
  });

  it("抜き出した範囲をインデントなしに揃える", () => {
    expect(dedent("    x\n      y")).toBe("x\n  y");
    expect(excerptBetween("  p\n  q\n\n  r", "p", "r")).toBe("p\nq");
    expect(lineSlice("  p\n  q\n  r", 1, 2)).toBe("q\nr");
  });
});

describe("強調する行の反映", () => {
  it("行ごとに帯の名前と薄く表示する印を付け直す", () => {
    document.body.innerHTML = '<div><span class="line"></span><span class="line"></span><span class="line"></span></div>';
    const scope = document.body;
    applyMark(scope, { bands: { a: [0], b: [1] }, skip: [2] });
    const lines = [...scope.querySelectorAll(".line")];
    expect(lines.map((line) => line.getAttribute("data-band"))).toEqual(["a", "b", null]);
    expect(lines[2]?.hasAttribute("data-skip")).toBe(true);
    applyMark(scope, { bands: { c: [2] } });
    expect(lines.map((line) => line.getAttribute("data-band"))).toEqual([null, null, "c"]);
    expect(lines.some((line) => line.hasAttribute("data-skip"))).toBe(false);
  });
});

describe("引用元のコード", () => {
  it("修正前の route は5つの処理を持つ", () => {
    expect(routeBefore).toContain("StartExaminationInput.parse");
    expect(routeBefore).toContain("appointmentOrThrow(repository");
    expect(routeBefore).toContain("saveAndAppendAudit(");
    expect(routeBefore).toContain('"ExaminationStarted"');
  });

  it("修正後の route と useCase は deps を使う", () => {
    expect(routeAfter).toContain("resolver: store,");
    expect(useCaseBody).toContain("deps.store.save(next);");
  });

  it("catch は文言で分岐する", () => {
    expect(routeCatch).toContain('error.message.includes("was not found")');
    expect(routeCatch).toContain("throw error;");
  });

  it("3種類の失敗の文言を取り出せる", () => {
    expect(throwNotFound).toContain("was not found");
    expect(throwInvalidState).toContain("state was");
    expect(throwPersistence).toContain("persistence failed");
  });

  it("失敗の型と、各工程のコードが取れる", () => {
    expect(errorTypes).toContain("export type StartExaminationError");
    expect(ensureFound).toContain('kind: "AppointmentNotFound"');
    expect(ensureCheckedIn).toContain('kind: "InvalidAppointmentState"');
    expect(pipelineBody).toContain(".andThen(ensureCheckedIn)");
    expect(pipelineFull.split("\n")[0]).toContain("export const startExamination");
    expect(isErrPipeline).toContain("found.isErr()");
  });

  it("通知コードの表と switch と match が取れる", () => {
    expect(noticeTable).toContain('InvalidAppointmentState: "invalid-state"');
    expect(noticeSwitch).toContain("switch (error.kind)");
    expect(matchCall).toContain("result.match");
    expect(onErrorLine).toContain("500");
  });

  it("画面のお知らせの文言を、画面のコードから取り出す", () => {
    expect(noticeMessage("AppointmentNotFound")).toBe("予約が見つかりません");
    expect(noticeMessage("InvalidAppointmentState")).toContain("実行できません");
  });

  it("map と andThen の説明用のコードは、違いが渡す関数の戻り値と失敗の型に現れる", () => {
    expect(mapFlowCode).toContain("f: (v: T) => U,");
    expect(andThenFlowCode).toContain("f: (v: T) => Result<U, E2>,");
    expect(andThenFlowCode).toContain("): Result<U, E1 | E2> => r.isOk()");
    expect(andThenFlowCode).toContain("? f(r.value)");
  });
});

describe("色の指定", () => {
  const sources = {
    ...components,
    "../DepsThenInputFlow.astro": depsThenInput,
    "../ExceptionOrResultAnimation.astro": exceptionOrResult,
    "./figure.css": figureCss,
  };

  it("図のファイルが同じ場所にある", () => {
    const names = Object.keys(components).map((path) => path.replace("./", ""));
    for (const name of figureNames) {
      expect(names).toContain(name);
    }
  });

  it("16進の固定色を書いていない", () => {
    const found = Object.entries(sources).flatMap(([path, source]) =>
      [...source.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((match) => `${path}: ${match[0]}`),
    );
    expect(found).toEqual([]);
  });

  it("色名やrgbの固定色を書いていない", () => {
    const found = Object.entries(sources).flatMap(([path, source]) =>
      [...source.matchAll(/\b(?:rgb|rgba|hsl|hsla)\(|:\s*(?:white|black|red|green|blue)\b/g)].map(
        (match) => `${path}: ${match[0]}`,
      ),
    );
    expect(found).toEqual([]);
  });
});
