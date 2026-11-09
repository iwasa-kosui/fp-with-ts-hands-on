import type { ChangeCase, ChangeCheckSet, MechanismInfo } from "../change-checks/types";

const mechanisms: readonly MechanismInfo[] = [
  {
    id: "lint",
    name: "Linter の規則",
    detail: "`[…]` に範囲を絞る条件を書く。引数の個数は `[arguments.length=…]`",
    code: `// selector: 検出するコードの形
selector: "NewExpression[callee.name='Date'][…]",`,
  },
  {
    id: "tests",
    name: "テスト",
    detail: "fake の store と clock で確かめる",
    code: "expect(harness.storeCalls).toBe(1);",
  },
];

const cases: readonly ChangeCase[] = [
  {
    id: "B1-new-date",
    kind: "bad",
    label: "時刻を new Date() から作る",
    baseCase: "G1-solution",
    target: "createEventContext の部分",
    diff: [
      { kind: "same", text: "const createEventContext = (deps: EventContextDependencies): EventContext => ({" },
      { kind: "same", text: "  eventId: deps.eventIdGenerator.generate()," },
      { kind: "del", text: "  occurredAt: deps.clock.now()," },
      { kind: "add", text: "  occurredAt: new Date().toISOString()," },
      { kind: "same", text: "});" },
    ],
    results: {
      lint: { found: true, output: "no-restricted-syntax: 現在時刻を直接読まず、clock から受け取ります。" },
      tests: { found: true, output: "2件失敗: expected +0 to be 1", setting: "expect(harness.clockReads).toBe(1);" },
    },
    why: "時刻は string のままなので、型検査は通ります。`new Date()` の形を見る規則と、clock を読んだ回数を確かめるテストが見つけます。",
  },
  {
    id: "B3-date-now",
    kind: "bad",
    label: "時刻を Date.now() から作る",
    baseCase: "G1-solution",
    target: "createEventContext の部分",
    diff: [
      { kind: "same", text: "const createEventContext = (deps: EventContextDependencies): EventContext => ({" },
      { kind: "same", text: "  eventId: deps.eventIdGenerator.generate()," },
      { kind: "del", text: "  occurredAt: deps.clock.now()," },
      { kind: "add", text: "  occurredAt: new Date(Date.now()).toISOString()," },
      { kind: "same", text: "});" },
    ],
    results: {
      lint: { found: true, output: "no-restricted-syntax: 現在時刻を直接読まず、clock から受け取ります。", setting: `// selector: 検出するコードの形
selector: "CallExpression[callee.object.name='Date'][…]",` },
      tests: { found: true, output: "2件失敗: expected +0 to be 1", setting: "expect(harness.clockReads).toBe(1);" },
    },
    why: "`new Date()` の規則だけではこの書き方を見つけられないので、`Date.now` の形の規則を別に足します。",
  },
  {
    id: "B2-random-uuid",
    kind: "bad",
    label: "ID を乱数から作る",
    baseCase: "G1-solution",
    target: "createEventContext の部分",
    diff: [
      { kind: "skip", text: "// import に EventId を足す" },
      { kind: "same", text: "const createEventContext = (deps: EventContextDependencies): EventContext => ({" },
      { kind: "del", text: "  eventId: deps.eventIdGenerator.generate()," },
      { kind: "add", text: "  eventId: EventId.parse(crypto.randomUUID())," },
      { kind: "same", text: "  occurredAt: deps.clock.now()," },
      { kind: "same", text: "});" },
    ],
    results: {
      lint: { found: true, output: "no-restricted-syntax: ID を直接作らず、ID generator から受け取ります。", setting: `// selector: 検出するコードの形
selector: "CallExpression[callee.object.name='crypto'][callee.property.name='randomUUID']",` },
      tests: { found: true, output: "1件失敗: expected [ { …(2) } ] to deeply equal [ { …(2) } ]", setting: "expect(harness.recordedEvents.map(…)).toEqual([…]);" },
    },
    why: "ID の型は変わらないので、型検査は通ります。`randomUUID` の呼び出しを見る規則と、固定の ID と比べるテストが見つけます。",
  },
  {
    id: "B4-two-saves",
    kind: "bad",
    label: "store を2回呼ぶ",
    baseCase: "G1-solution",
    target: "useCase の最後の部分",
    diff: [
      { kind: "same", text: "      .map(startExaminationEvent(deps, input.veterinarianId))" },
      { kind: "same", text: "      .andThrough(deps.examinationStartedStore.store)" },
      { kind: "add", text: "      .andThrough(deps.examinationStartedStore.store)" },
      { kind: "same", text: "      .map((event) => event.aggregateState);" },
    ],
    results: {
      lint: { found: false, output: "エラーなし" },
      tests: { found: true, output: "2件失敗: expected 2 to be 1" },
    },
    why: "同じ関数を2回呼ぶ書き方は規則の形に当てはまりません。呼んだ回数を数えるテストだけが見つけます。",
  },
  {
    id: "B5-clock-read-twice",
    kind: "bad",
    label: "clock を読み直す",
    baseCase: "G1-solution",
    target: "useCase の最後の部分",
    diff: [
      { kind: "same", text: "      .map(startExaminationEvent(deps, input.veterinarianId))" },
      { kind: "add", text: "      .map((event) => ({ ...event, occurredAt: deps.clock.now() }))" },
      { kind: "same", text: "      .andThrough(deps.examinationStartedStore.store)" },
      { kind: "same", text: "      .map((event) => event.aggregateState);" },
    ],
    results: {
      lint: { found: false, output: "エラーなし" },
      tests: { found: true, output: "1件失敗: expected 2 to be 1", setting: "expect(harness.clockReads).toBe(1);" },
    },
    why: "`deps.clock.now()` は許された書き方なので、規則は通します。読んだ回数を確かめるテストだけが見つけます。",
  },
  {
    id: "G2-date-from-timestamp",
    kind: "good",
    label: "clock の時刻から Date を作る（正しいコード）",
    baseCase: "G1-solution",
    target: "createEventContext の部分",
    diff: [
      { kind: "same", text: "const createEventContext = (deps: EventContextDependencies): EventContext => ({" },
      { kind: "same", text: "  eventId: deps.eventIdGenerator.generate()," },
      { kind: "del", text: "  occurredAt: deps.clock.now()," },
      { kind: "add", text: "  occurredAt: new Date(deps.clock.now()).toISOString()," },
      { kind: "same", text: "});" },
    ],
    results: {
      lint: { found: false, output: "エラーなし" },
      tests: { found: false, output: "4件成功" },
    },
    why: "引数のある `new Date(...)` は clock の値を使っています。条件を引数なしに絞った規則は、これを誤検知（正しいコードを悪い変更として検出すること）しません。",
  },
];

export const session06ChangeChecks: ChangeCheckSet = {
  example: "session-06-solution",
  ariaLabel: "悪い変更と2つの仕組みの結果",
  mechanisms,
  cases,
};
