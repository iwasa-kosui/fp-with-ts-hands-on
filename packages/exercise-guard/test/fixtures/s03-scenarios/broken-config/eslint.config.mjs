import tseslint from "typescript-eslint";

export default [
  {
    files: ["exercises/guard/cases/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error"
    },
  ,
];
