# Halaqati v2.12 Architecture — Phase 1

```text
index.html
  -> src/main.js (module)
      -> core/script-loader.js
      -> core/lazy-libs.js
      -> core/pwa.js
      -> legacy/app.js?url (classic compatibility runtime, hashed by Vite)
      -> features/reports/lazy.js
      -> features/import/lazy.js
      -> features/ocr/lazy.js

public/core/   = boot-critical local assets, precached
public/vendor/ = heavy feature assets, lazy + runtime cached
dist/          = the only webDir for both GitHub Pages and Capacitor
```

## Migration rule
Each future feature is extracted behind the same public function contract used by the current HTML `onclick` handlers. When a feature has been fully migrated, its legacy functions are deleted from `legacy/app.js`.
