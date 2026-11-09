export const noticeMoments = [
  { id: "write", label: "書いているとき" },
  { id: "test", label: "テストのとき" },
  { id: "run", label: "動かしているとき" },
  { id: "human", label: "人が気づくとき" },
] as const;

export type NoticeMomentId = (typeof noticeMoments)[number]["id"];
