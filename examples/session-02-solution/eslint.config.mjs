import tseslint from "typescript-eslint";

// ルールは "ルール名": ["error", { オプション }] の形で rules に書きます
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
