# حلقتي v2.40.3 — Public API Fix 6

هذا الإصدار التصحيحي لا يغيّر منطق التطبيق ولا تصميم التقارير. يثبت مسار PDF المتجهي Chromium/Android PrintManager ويصحح فحص GitHub Actions نفسه حتى يعمل من جذر المستودع بدون الاعتماد على working-directory هش.

## ما تم تثبيته
- PDF متجهي عبر WebView/Chromium وPrintManager الرسمي.
- Cairo + RTL + نص قابل للتحديد والنسخ والبحث.
- عدم استخدام html2canvas أو 300 DPI أو hidden PrintDocumentAdapter callbacks.
- موديول Android يعلن AppCompat وCore على compile classpath ومتوافق مع Java 21 / API 36.
- فحص preflight مستقل يعتمد على مسار الملف نفسه، لذلك يمكن تشغيله من أي working directory.

## سبب FIX6
سجل GitHub السابق توقف في خطوة Validate HalaqatiPdf Capacitor 8 compile classpath قبل npm ci. السبب كان خطأ في الـWorkflow: خطوة الفحص كانت تعمل من جذر المستودع بينما المسارات مكتوبة بالنسبة إلى مجلد app. ملفات الإضافة نفسها كانت موجودة داخل app. في FIX6 تم استبدال هذا الفحص بسكربت Node مستقل يحدد جذر المشروع من موقع السكربت نفسه.
