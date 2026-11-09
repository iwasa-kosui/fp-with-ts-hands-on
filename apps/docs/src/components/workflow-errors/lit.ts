export type Mark = Readonly<{
  bands?: Readonly<Record<string, readonly number[]>>;
  skip?: readonly number[];
}>;

export const applyMark = (scope: ParentNode, mark: Mark | undefined): void => {
  const lines = [...scope.querySelectorAll<HTMLElement>(".line")];
  lines.forEach((line) => {
    line.removeAttribute("data-band");
    line.removeAttribute("data-skip");
  });
  Object.entries(mark?.bands ?? {}).forEach(([band, indexes]) =>
    indexes.forEach((index) => lines[index]?.setAttribute("data-band", band)),
  );
  mark?.skip?.forEach((index) => lines[index]?.setAttribute("data-skip", ""));
};
