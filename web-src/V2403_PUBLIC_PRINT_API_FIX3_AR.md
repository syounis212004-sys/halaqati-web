# حلقاتي v2.40.3 — Public Print API Fix 3

هذا الإصلاح يبسّط إضافة HalaqatiPdf على Android إلى أقل سطح API رسمي ممكن:

- Chromium/WebView حقيقي.
- `createPrintDocumentAdapter()` الرسمي.
- `PrintManager.print()` الرسمي.
- لا `PrintJob` monitoring داخل الإضافة.
- لا `LayoutResultCallback` أو `WriteResultCallback` المخفيين.
- لا Reflection.
- لا html2canvas أو Raster PDF.
- Cairo وRTL والتقرير المتجهي محفوظون.

عند الضغط على PDF في Android تفتح شاشة الطباعة الرسمية، ثم يختار المستخدم **Save as PDF / حفظ بتنسيق PDF**.

كما تم تعديل GitHub Actions ليطبع ملخص compiler الحقيقي عند فشل Java بدل إغراق السجل بـ Gradle stacktrace.
