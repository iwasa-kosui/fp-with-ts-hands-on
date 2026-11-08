// 参照実装の行がずれたら、古いコードを見せないようにビルドを失敗させる
export const quote = (source: string, from: number, to: number, firstLine: string): string => {
  const lines = source.split("\n").slice(from - 1, to);
  if (!lines[0]?.includes(firstLine)) throw new Error(`引用元の行がずれています: ${firstLine}`);
  const indent = Math.min(...lines.filter((line) => line.trim() !== "").map((line) => line.search(/\S/)));
  return lines.map((line) => line.slice(indent)).join("\n");
};
