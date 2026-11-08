export type SessionPageKind =
  | "brief"
  | "teach"
  | "exercise"
  | "review"
  | "advanced";

export type SessionPageFlow =
  | "background"
  | "problem"
  | "knowledge"
  | "solution"
  | "work"
  | "advanced";

export type SessionPage = Readonly<{
  slug: string;
  title: string;
  flow: SessionPageFlow;
  kind: SessionPageKind;
  minutes: number;
  role: string;
}>;

export const sessionPageFlowOrder = [
  "background",
  "problem",
  "knowledge",
  "solution",
  "work",
  "advanced",
] as const satisfies readonly SessionPageFlow[];

export const sessionPageFlowLabels = {
  background: "背景",
  problem: "課題",
  knowledge: "事前知識",
  solution: "解決策",
  work: "業務で考える",
  advanced: "あとで読む（発展）",
} as const satisfies Record<SessionPageFlow, string>;

export const splitPageRole = (
  role: string,
): Readonly<{ label: string; text: string }> => {
  const separator = role.indexOf(": ");
  return separator < 0
    ? { label: "", text: role }
    : { label: role.slice(0, separator), text: role.slice(separator + 2) };
};
