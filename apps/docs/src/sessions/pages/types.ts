export type SessionPageKind =
  | "brief"
  | "teach"
  | "exercise"
  | "review"
  | "advanced";

export type SessionPage = Readonly<{
  slug: string;
  title: string;
  kind: SessionPageKind;
  minutes: number;
}>;

export const sessionPageKindOrder = [
  "brief",
  "teach",
  "exercise",
  "review",
  "advanced",
] as const satisfies readonly SessionPageKind[];

export const sessionPageKindLabels = {
  brief: "導入",
  teach: "事前知識",
  exercise: "演習",
  review: "ふりかえり",
  advanced: "あとで読む（発展）",
} as const satisfies Record<SessionPageKind, string>;
