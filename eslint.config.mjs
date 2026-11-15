// Correctness checks compatible with existing classic-script globals.
// Module migration and legacy formatting changes are outside environment setup.
export default [
  {
    files: ["web-src/src/**/*.js"],
    languageOptions: { ecmaVersion: "latest", sourceType: "script" },
    rules: {
      "no-debugger": "error",
      "no-dupe-args": "error",
      "no-unreachable": "error",
      "no-dupe-keys": "error",
    },
  },
  {
    files: [
      "web-src/src/main.js",
      "web-src/src/features/**/lazy.js",
      "web-src/src/core/update-ui.js",
      "web-src/src/core/offline-store.js",
      "web-src/src/core/lazy-libs.js",
      "web-src/src/core/script-loader.js",
      "web-src/src/core/pwa.js",
      "web-src/src/features/plans/engine.js",
      "web-src/src/features/notifications/push-bridge.js",
    ],
    languageOptions: { sourceType: "module" },
  },
];
