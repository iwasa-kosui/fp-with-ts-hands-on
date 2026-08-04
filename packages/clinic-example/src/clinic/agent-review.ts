export type ReviewPrincipleKind =
  | "StateTransition"
  | "BoundaryValidation"
  | "SensitiveData"
  | "ResultError"
  | "DomainEvent";

export type AgentReviewChecklistItem = Readonly<{
  kind: ReviewPrincipleKind;
  question: string;
  mustMention: readonly string[];
}>;

export const agentReviewChecklist: readonly AgentReviewChecklistItem[] = [
  {
    kind: "StateTransition",
    question: "Paid と Canceled を終端状態として扱い、戻る遷移を追加していないか。",
    mustMention: ["Paid", "Canceled", "終端状態"],
  },
  {
    kind: "BoundaryValidation",
    question: "外部から来た検査結果 payload を Zod で parse してから使っているか。",
    mustMention: ["unknown", "Zod", "parse"],
  },
  {
    kind: "SensitiveData",
    question: "ownerEmail や ownerPhone を unwrap してログや戻り値に混ぜていないか。",
    mustMention: ["Sensitive", "unwrap", "ログ"],
  },
  {
    kind: "ResultError",
    question: "失敗理由を throw ではなく Result の error.kind として返しているか。",
    mustMention: ["Result", "error.kind", "throw"],
  },
  {
    kind: "DomainEvent",
    question: "成功した状態変更だけを domain event として記録しているか。",
    mustMention: ["domain event", "成功時", "FollowUpRequested"],
  },
];

export const buildFollowUpAgentPrompt = (): string => [
  "電話フォロー対象を抽出してください。",
  "- Paid / Canceled は終端状態として扱い、終端状態から別状態へ戻す遷移を追加しない",
  "- 外部から来た unknown の検査結果 payload は Zod で parse する",
  "- Sensitive な ownerEmail / ownerPhone を unwrap してログに出さない",
  "- 失敗は throw せず Result の error.kind で返す",
  "- 成功時だけ FollowUpRequested domain event を記録する",
].join("\n");
