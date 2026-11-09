import type { GuardGuide, GuardGuideSegment } from "./CaseList";

export const defaultGuide: GuardGuide = {
  title: "この演習の手順",
  steps: [
    "誤った変更をコードで確認する",
    "どの仕組みで検出するかを選ぶ",
    "仕組みを追加して「検出を検証する」を押す",
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
      const { id, text, items = [], reference } =
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
          {reference === undefined ? null : (
            <details className="guard-exercise__reference">
              <summary>{reference.summary}</summary>
              <p>{reference.text}</p>
              <figure>
                <figcaption>{reference.caption}</figcaption>
                <pre>
                  <code>{reference.code}</code>
                </pre>
              </figure>
            </details>
          )}
        </li>
      );
    })}
  </ol>
);
