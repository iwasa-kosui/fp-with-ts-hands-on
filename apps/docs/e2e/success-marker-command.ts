export type SuccessMarkerCommand = Readonly<{
  command: string;
  marker: string;
}>;

export const withSuccessMarker = (
  command: string,
  markerParts: readonly [string, string],
): SuccessMarkerCommand => {
  const [first, second] = markerParts;
  return {
    command: `${command} && printf '%s%s\\n' '${first}' '${second}'`,
    marker: `${first}${second}`,
  };
};
