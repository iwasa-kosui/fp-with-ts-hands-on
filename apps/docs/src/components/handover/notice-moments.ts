export const noticeMoments = [
  { id: "write", label: "型検査のとき" },
  { id: "test", label: "テストのとき" },
  { id: "run", label: "実行時" },
  { id: "human", label: "人が発見するとき" },
] as const;

export type NoticeMomentId = (typeof noticeMoments)[number]["id"];
