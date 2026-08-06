export type ReviewPrincipleKind =
  | "StateTransition"
  | "BoundaryValidation"
  | "SensitiveData"
  | "ResultError"
  | "DomainEvent";

export type AgentReviewChecklistItem = Readonly<{
  kind: ReviewPrincipleKind;
  mustMention: ReadonlyArray<string>;
}>;

export const agentReviewChecklist = [
  { kind: "StateTransition", mustMention: ["kind", "pure transition"] },
  { kind: "BoundaryValidation", mustMention: ["unknown", "schema"] },
  { kind: "SensitiveData", mustMention: ["nodejs.util.inspect.custom"] },
  { kind: "ResultError", mustMention: ["Result", "kind"] },
  { kind: "DomainEvent", mustMention: ["save(state, events)", "atomic"] },
] as const satisfies ReadonlyArray<AgentReviewChecklistItem>;

export const buildFollowUpAgentPrompt = (): string =>
  agentReviewChecklist
    .flatMap(({ kind, mustMention }) => [`## ${kind}`, ...mustMention])
    .join("\n");
