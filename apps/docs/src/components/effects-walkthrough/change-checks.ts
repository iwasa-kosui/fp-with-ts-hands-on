import type { ChangeCase, ChangeCheckSet, MechanismInfo } from "../change-checks/types";

const mechanisms: readonly MechanismInfo[] = [
  {
    id: "lint",
    name: "Linter のルール",
    detail: "`[…]` に範囲を絞る条件を記述する。引数の個数は `[arguments.length=…]`",
    code: `// selector: 検出するコードの形
selector: "NewExpression[callee.name='Date'][…]",`,
  },
  {
    id: "tests",
    name: "テスト",
    detail: "fake の store と clock で検証する",
    code: "expect(harness.storeCalls).toBe(1);",
  },
];

const cases: readonly ChangeCase[] = [
  {
    id: "B1-new-date",
    kind: "bad",
    label: "時刻を new Date() から生成する",
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
      tests: { found: true, output: "テスト4件のうち2件失敗: expected +0 to be 1", setting: "expect(harness.clockReads).toBe(1);" },
    },
    why: "時刻は string のままであるため、型検査は通ります。`new Date()` の形を検査する Linter のルールと、clock を取得した回数を検証するテストが検出します。",
  },
  {
    id: "B3-date-now",
    kind: "bad",
    label: "時刻を Date.now() から生成する",
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
      tests: { found: true, output: "テスト4件のうち2件失敗: expected +0 to be 1", setting: "expect(harness.clockReads).toBe(1);" },
    },
    why: "`new Date()` のルールだけではこの実装を検出できないため、`Date.now` の形のルールを別に追加します。",
  },
  {
    id: "B2-random-uuid",
    kind: "bad",
    label: "ID を乱数から生成する",
    baseCase: "G1-solution",
    target: "createEventContext の部分",
    diff: [
      { kind: "skip", text: "// import に EventId を追加する" },
      { kind: "same", text: "const createEventContext = (deps: EventContextDependencies): EventContext => ({" },
      { kind: "del", text: "  eventId: deps.eventIdGenerator.generate()," },
      { kind: "add", text: "  eventId: EventId.parse(crypto.randomUUID())," },
      { kind: "same", text: "  occurredAt: deps.clock.now()," },
      { kind: "same", text: "});" },
    ],
    results: {
      lint: { found: true, output: "no-restricted-syntax: ID を直接作らず、ID generator から受け取ります。", setting: `// selector: 検出するコードの形
selector: "CallExpression[callee.object.name='crypto'][callee.property.name='randomUUID']",` },
      tests: { found: true, output: "テスト4件のうち1件失敗: expected [ { …(2) } ] to deeply equal [ { …(2) } ]", setting: "expect(harness.recordedEvents.map(…)).toEqual([…]);" },
    },
    why: "ID の型は変わらないため、型検査は通ります。`randomUUID` の呼び出しを検査するルールと、固定の ID と比較するテストが検出します。",
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
      tests: { found: true, output: "テスト4件のうち2件失敗: expected 2 to be 1" },
    },
    why: "同じ関数を2回呼ぶ実装はルールの形に当てはまりません。呼び出した回数を検証するテストだけが検出します。",
  },
  {
    id: "B5-clock-read-twice",
    kind: "bad",
    label: "clock を再取得する",
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
      tests: { found: true, output: "テスト4件のうち1件失敗: expected 2 to be 1", setting: "expect(harness.clockReads).toBe(1);" },
    },
    why: "`deps.clock.now()` は許可された実装であるため、ルールは検出しません。この変更では、状態と監査記録の時刻が食い違います。clock を取得した回数を検証するテストだけが検出します。",
  },
  {
    id: "G2-date-from-timestamp",
    kind: "good",
    label: "clock の時刻から Date を生成する（正しいコード）",
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
      tests: { found: false, output: "テスト4件のうち4件成功" },
    },
    why: "正しいコードの別の例です。引数のある `new Date(...)` は clock が返した時刻から計算するだけで、現在時刻を取得しません。検出すると誤検知（正しいコードを誤った変更として検出すること）になるため、ルールは条件を引数なしに絞ります。",
  },
];

export const session06ChangeChecks: ChangeCheckSet = {
  example: "session-06-solution",
  ariaLabel: "誤った変更と2つの仕組みの結果",
  mechanisms,
  cases,
};
