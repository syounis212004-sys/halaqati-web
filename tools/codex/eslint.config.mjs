export default [
  { ignores: ["node_modules/**", "playwright-report/**", "test-results/**"] },
  {
    files: ["**/*.mjs"],
    languageOptions: { ecmaVersion: "latest", sourceType: "module" },
    rules: {
      "no-debugger": "error",
      "no-dupe-args": "error",
      "no-unreachable": "error",
    },
  },
];
