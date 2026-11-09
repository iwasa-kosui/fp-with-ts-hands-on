// Astro の getCachedHighlighter のキーには langs などの決まった名前のプロパティしか残らないので、langs に transformer を区別する文字列を入れる。
export const keyedTransformer = <T extends object>(key: string, transformer: T): T & { langs: string[] } => ({
  ...transformer,
  langs: [key],
});
