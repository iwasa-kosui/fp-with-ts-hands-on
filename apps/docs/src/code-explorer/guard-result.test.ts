import { describe, expect, it } from "vitest";
import { parseGuardResult } from "./guard-result";
import { cell, sampleGuardResult } from "./guard-result.fixture";

describe("parseGuardResult", () => {
  it("reads the JSON that the judge writes", () => {
    expect(parseGuardResult(JSON.stringify(sampleGuardResult))).toEqual(
      sampleGuardResult,
    );
  });

  it("returns nothing for text that is not JSON", () => {
    expect(parseGuardResult("not json")).toBeUndefined();
  });

  it("returns nothing for another version", () => {
    expect(
      parseGuardResult(JSON.stringify({ ...sampleGuardResult, version: 2 })),
    ).toBeUndefined();
  });

  it("returns nothing when a row lacks a cell", () => {
    const [first, ...rest] = sampleGuardResult.rows;
    const broken = {
      ...sampleGuardResult,
      rows: [{ ...first, cells: { types: cell("na") } }, ...rest],
    };

    expect(parseGuardResult(JSON.stringify(broken))).toBeUndefined();
  });
});
