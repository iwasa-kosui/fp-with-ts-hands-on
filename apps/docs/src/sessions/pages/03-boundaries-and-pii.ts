import type { SessionPage } from "./types";

export const sessionSlug = "03-boundaries-and-pii";

export const sessionPages = [
  { slug: "", title: "獣医師の欄に「夜勤」と届いた", kind: "brief", minutes: 1 },
  { slug: "current-code", title: "今のコードは必ず成功を返す", kind: "brief", minutes: 1 },
  { slug: "boundary", title: "外側・境界・内側", kind: "teach", minutes: 2 },
  { slug: "result", title: "Result は成否だけを持つ小さな型", kind: "teach", minutes: 1 },
  { slug: "zod", title: "Zod: 1つの schema から型を作る", kind: "teach", minutes: 1.5 },
  { slug: "safe-parse", title: "schema で検査して Result を返す", kind: "teach", minutes: 1.5 },
  { slug: "branded", title: "Branded Type: 同じ string を用途で区別する", kind: "teach", minutes: 2 },
  { slug: "boundary-after", title: "境界を通った値だけが内側へ入る", kind: "teach", minutes: 2 },
  { slug: "terms", title: "学んだことに名前を付ける", kind: "teach", minutes: 0.5 },
  { slug: "audit-record", title: "連絡先を記録に残さない", kind: "teach", minutes: 1.5 },
  { slug: "checks", title: "値の性質をテストで確かめる", kind: "teach", minutes: 1 },
  { slug: "exercise", title: "演習: 悪い変更を検出する仕組みを足す", kind: "exercise", minutes: 15 },
  { slug: "peer-review", title: "相互レビュー", kind: "review", minutes: 3 },
  { slug: "review", title: "個人の確認と持ち帰り", kind: "review", minutes: 1 },
  { slug: "guard", title: "仕組みで防ぐ方法を話す", kind: "review", minutes: 1 },
  { slug: "payment-amount", title: "値の制約にも同じ形を使う", kind: "advanced", minutes: 0 },
  { slug: "pii", title: "Sensitive で値を伏せる", kind: "advanced", minutes: 0 },
  { slug: "value-shapes", title: "扱う値が変わっても形は同じ", kind: "advanced", minutes: 0 },
] as const satisfies readonly SessionPage[];
