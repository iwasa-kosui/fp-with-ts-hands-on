export type CodeHighlight = Readonly<{
  startLineNumber: number;
  endLineNumber: number;
}>;

export type CodeGuide = Readonly<{
  id: string;
  title: string;
  currentDesign: string;
  futureRisk: string;
  path: string;
  highlights: readonly CodeHighlight[];
}>;
