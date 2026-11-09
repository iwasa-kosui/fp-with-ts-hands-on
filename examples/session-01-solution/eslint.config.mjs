import tseslint from "typescript-eslint";

// ルールの骨組み:
// "no-restricted-syntax": ["error", {
//   selector: "検出するコードの形",
//   message: "報告する文",
// }]
// selector の読み方:
// 「A > B」は A の直下の B です。
// 「B[x.y=/…/]」は、項目 x.y が
// 正規表現に一致する B です。
// TSAsExpression は as の式です。
// TSTypeReference は型の名前です。
// TSUnknownKeyword は unknown です。
const rules = {};

export default [
  {
    files: ["exercises/guard/cases/**/*.ts"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: { "@typescript-eslint": tseslint.plugin },
    rules,
  },
];
