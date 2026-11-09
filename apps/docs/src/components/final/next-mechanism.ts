export const whats = [
  {
    id: "as-lint",
    wish: "as を使わない",
    name: "Linter の規則",
    detail: "typescript-eslint の consistent-type-assertions を assertionStyle: \"never\" で有効にします。as const は対象外です。",
    recommended: "on-save",
  },
  {
    id: "required-checks",
    wish: "テストを通してから merge する",
    name: "GitHub の保護ブランチの required status checks",
    detail: "指定した CI の検査が成功するまで merge できなくする設定です。",
    recommended: "ci",
  },
  {
    id: "codeowners",
    wish: "テストを勝手に書き換えない",
    name: "GitHub の CODEOWNERS と Require review from Code Owners",
    detail: "指定したパスの変更に、コードオーナーの承認を必須にします。",
    recommended: "ci",
  },
  {
    id: "pre-tool-use",
    wish: "禁止した操作を実行しない",
    name: "Agent の実行前 hook",
    detail: "Claude Code の PreToolUse hook は、exit code 2 でツールの実行を取り消します。",
    recommended: "agent-hook",
  },
  {
    id: "agent-context",
    wish: "同じ指示を毎回書かない",
    name: "Agent が読むコンテキストとスキル",
    detail: "これは伝える仕組みで、守られなかったときの検出はしません。検出する仕組みと組にします。",
    recommended: undefined,
  },
] as const;

export const wheres = [
  { id: "on-save", name: "保存時", text: "エディタがファイルを保存したときに動きます。自分にはすぐ見えますが、ほかの人には強制できません。" },
  { id: "pre-commit", name: "pre-commit", text: "git commit の直前に動きます。commit の前に気づけますが、--no-verify で飛ばせます。" },
  { id: "ci", name: "CI の必須チェック", text: "push の後にサーバーで動き、成功するまで merge できなくします。全員に同じ基準がかかります。" },
  { id: "agent-hook", name: "AI の実行前 hook", text: "AI がツールを実行する直前に動き、実行を取り消せます。" },
] as const;

export type WhatId = (typeof whats)[number]["id"];
export type WhereId = (typeof wheres)[number]["id"];
export type Selection = { what?: WhatId; where?: WhereId };
export type Saved = { version: 1 } & Selection;

export const STORAGE_KEY = "fp-with-ts:next-mechanism:final";

const whatIds: readonly string[] = whats.map(({ id }) => id);
const whereIds: readonly string[] = wheres.map(({ id }) => id);

export const findWhat = (id: string | undefined) => whats.find((item) => item.id === id);
export const findWhere = (id: string | undefined) => wheres.find((item) => item.id === id);

export const load = (): Selection => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    const { what, where } = parsed as { what?: unknown; where?: unknown };
    const result: Selection = {};
    if (typeof what === "string" && whatIds.includes(what)) result.what = what as WhatId;
    if (typeof where === "string" && whereIds.includes(where)) result.where = where as WhereId;
    return result;
  } catch {
    return {};
  }
};

export const save = (selection: Selection): void => {
  try {
    const saved: Saved = { version: 1, ...selection };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  } catch {
    return;
  }
};
