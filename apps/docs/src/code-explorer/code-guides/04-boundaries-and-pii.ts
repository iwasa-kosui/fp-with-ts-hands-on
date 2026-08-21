import type { CodeGuide } from "../code-guide";

export default [
  {
    id: "unvalidated-exam-json",
    title: "入力された検査 JSON を any のままドメイン型へ入れている",
    currentDesign: "入力値の形式を検証せず、手書きの ExamResult へ詰め替えています。",
    futureRisk: "petId の欠落が境界を通過し、後続の処理で初めて壊れます。",
    path: "src/boundary/examResult.ts",
    highlights: [{ startLineNumber: 5, endLineNumber: 20 }],
  },
  {
    id: "plain-contact-pii",
    title: "input から連絡先を文字列のまま返している",
    currentDesign: "ownerName・email・phone を any からそのままコピーしています。",
    futureRisk: "JSON化やログ出力で個人情報がそのまま露出します。",
    path: "src/boundary/ownerContact.ts",
    highlights: [{ startLineNumber: 3, endLineNumber: 16 }],
  },
] as const satisfies readonly CodeGuide[];
