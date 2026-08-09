import { describe, expect, test } from "vitest";

import {
  AuditJsonObject,
  AuditJsonValue,
} from "../../src/domain/shared/auditJson.js";
import { SensitiveAuditPayload } from "../../src/useCase/query/sensitiveAuditPayloadDisclosure.js";

const specialObjectJson = `{"__proto__":{"evidence":"root-proto"},"constructor":{"evidence":"root-constructor"},"prototype":{"evidence":"root-prototype"},"nested":{"__proto__":{"evidence":"nested-proto"},"constructor":{"evidence":"nested-constructor"},"prototype":{"evidence":"nested-prototype"}},"html":"</pre><script>alert('xss')</script>"}`;

describe("Audit JSON identity-preserving codec", () => {
  test("元のJSON.parse済みobject identityとroot/nestedの全own keyを保持する", () => {
    const raw: unknown = JSON.parse(specialObjectJson);
    const result = AuditJsonObject.parse(raw);

    const decoded = result._unsafeUnwrap();
    expect(decoded).toBe(raw);
    const nested = Object.getOwnPropertyDescriptor(decoded, "nested")?.value;
    expect(nested).not.toBeNull();
    expect(typeof nested).toBe("object");
    if (nested === null || typeof nested !== "object") return;
    for (const value of [decoded, nested]) {
      expect(Object.hasOwn(value, "__proto__")).toBe(true);
      expect(Object.hasOwn(value, "constructor")).toBe(true);
      expect(Object.hasOwn(value, "prototype")).toBe(true);
    }
    expect(Object.keys(decoded)).toEqual([
      "__proto__",
      "constructor",
      "prototype",
      "nested",
      "html",
    ]);
    expect(Object.keys(nested)).toEqual([
      "__proto__",
      "constructor",
      "prototype",
    ]);
    expect(JSON.stringify(decoded)).toBe(specialObjectJson);
    expect(JSON.parse(JSON.stringify(decoded))).toEqual(
      JSON.parse(specialObjectJson),
    );
    expect(Object.getOwnPropertyDescriptor({}, "evidence")).toBeUndefined();
    expect("evidence" in {}).toBe(false);
    expect(Object.prototype).not.toHaveProperty("evidence");
  });

  test("SensitiveAuditPayload境界もstate/payloadのobject identityを再構築せず返す", () => {
    const state: unknown = JSON.parse(specialObjectJson);
    const payload: unknown = JSON.parse(specialObjectJson);
    const result = SensitiveAuditPayload.parse({
      aggregateState: state,
      eventPayload: payload,
    });

    const decoded = result._unsafeUnwrap();
    expect(decoded.aggregateState).toBe(state);
    expect(decoded.eventPayload).toBe(payload);
    expect(JSON.stringify(decoded)).toBe(
      `{"aggregateState":${specialObjectJson},"eventPayload":${specialObjectJson}}`,
    );
  });

  test.each([
    ["undefined", undefined],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["bigint", BigInt(1)],
    ["function", () => "not-json"],
    ["symbol", Symbol("not-json")],
    ["Date", new Date("2026-08-10T00:00:00.000Z")],
    ["undefined property", { value: undefined }],
    ["non-finite property", { value: Number.NEGATIVE_INFINITY }],
    ["undefined array item", [undefined]],
  ])("%sをJSON値として拒否する", (_label, value) => {
    expect(AuditJsonValue.parse(value).isErr()).toBe(true);
  });

  test("symbol key・accessor・cycleをJSON値として拒否する", () => {
    const symbolKey = { ordinary: true };
    Object.defineProperty(symbolKey, Symbol("hidden"), {
      enumerable: true,
      value: "not-json",
    });
    const accessor = {};
    Object.defineProperty(accessor, "value", {
      enumerable: true,
      get: () => "not-json-data-property",
    });
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;

    for (const value of [symbolKey, accessor, cyclic]) {
      expect(AuditJsonValue.parse(value).isErr()).toBe(true);
    }
  });

  test.each([null, [], "payload", 1, true])(
    "eventPayload rootの%jをobject境界で拒否する",
    (eventPayload) => {
      expect(SensitiveAuditPayload.parse({
        aggregateState: null,
        eventPayload,
      }).isErr()).toBe(true);
    },
  );

  test("finite numberとJSON primitive/arrayは値境界で受理する", () => {
    const raw: unknown = JSON.parse(
      `{"zero":0,"negative":-1,"decimal":1.25,"values":[null,true,false,"text"]}`,
    );

    expect(AuditJsonValue.parse(raw)._unsafeUnwrap()).toBe(raw);
  });
});
