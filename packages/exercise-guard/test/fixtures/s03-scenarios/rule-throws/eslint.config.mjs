import tseslint from "typescript-eslint";

const local = {
  rules: {
    explodes: {
      create: () => ({
        Program: () => {
          throw new Error("この規則は実行中に例外を投げます");
        },
      }),
    },
  },
};

export default [
  {
    files: ["exercises/guard/cases/**/*.ts"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { projectService: true, tsconfigRootDir: process.cwd() },
    },
    plugins: { local },
    rules: { "local/explodes": "error" },
  },
];
