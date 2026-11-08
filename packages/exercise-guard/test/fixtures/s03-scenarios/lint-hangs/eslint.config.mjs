import tseslint from "typescript-eslint";

const local = {
  rules: {
    forever: {
      create: () => {
        while (true) {}
      },
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
    rules: { "local/forever": "error" },
  },
];
