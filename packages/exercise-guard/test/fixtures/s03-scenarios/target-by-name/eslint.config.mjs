import tseslint from "typescript-eslint";

const languageOptions = {
  parser: tseslint.parser,
  parserOptions: { projectService: true, tsconfigRootDir: process.cwd() },
};

export default [
  {
    files: ["exercises/guard/cases/**/*.ts"],
    languageOptions,
    plugins: { "@typescript-eslint": tseslint.plugin },
    rules: {},
  },
  {
    files: ["exercises/guard/cases/B*.ts"],
    rules: { "no-restricted-syntax": ["error", "Program"] },
  },
];
