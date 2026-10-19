# Halaqati v2.40.3 — Public Print API Fix 4

هذا الإصلاح مبني على FIX3 ويعالج تعارض اختبار العربية مع المحرك نفسه بدل تعطيل الاختبار.

- يبقى التصدير Android Vector عبر `WebView -> createPrintDocumentAdapter() -> PrintManager.print()` فقط.
- لا توجد `PrintJob` ولا `LayoutResultCallback` ولا `WriteResultCallback` ولا Reflection.
- أصبح WebView ينتظر فعليًا `document.fonts.status === 'loaded'` واكتمال الصور و`document.readyState` قبل فتح شاشة Save as PDF.
- انتظار الخطوط يتم عبر `evaluateJavascript` وهي API عامة، مع مهلة وفallback يمنع التعليق.
- يحافظ على Cairo وRTL وAuto-Fit والنص القابل للتحديد والنسخ والبحث.
