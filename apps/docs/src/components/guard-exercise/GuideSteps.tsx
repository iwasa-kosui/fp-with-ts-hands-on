import type { GuardGuide, GuardGuideSegment } from "./CaseList";

export const defaultGuide: GuardGuide = {
  title: "この演習でやること",
  steps: [
    "悪い変更をコードで見る",
    "どの仕組みで検出するかを選ぶ",
    "仕組みを足して「検出を確かめる」を押す",
  ],
};

const segmentsKey = (segments: readonly GuardGuideSegment[]): string =>
  segments
    .map((segment) => (typeof segment === "string" ? segment : segment.text))
    .join("");

export const GuideSteps = ({
  steps,
}: Readonly<{ steps: GuardGuide["steps"] }>) => (
  <ol className="guard-exercise__steps">
    {steps.map((step) => {
      const { id, text, items = [] } =
        typeof step === "string" ? { text: step } : step;
      const segments = typeof text === "string" ? [text] : text;
      return (
        <li key={id ?? segmentsKey(segments)} id={id}>
          {segments.map((segment, index) =>
            typeof segment === "string" ? (
              segment
            ) : (
              <a key={`${index}:${segment.href}`} href={segment.href}>
                {segment.text}
              </a>
            ),
          )}
          {items.length === 0 ? null : (
            <ul>
              {items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </li>
      );
    })}
  </ol>
);
