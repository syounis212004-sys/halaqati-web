# حلقتي v2.40.3 — Public Android Print API Hotfix

هذا الإصلاح يستبدل الاستدعاء المباشر لـ `PrintDocumentAdapter.LayoutResultCallback` و`WriteResultCallback` لأن مُنشئاتها مخفية من Android Public SDK (`@hide`) وتسبب فشل `compileReleaseJavaWithJavac`.

## السلوك الجديد على Android
- التقرير يبقى HTML/CSS ويُطبع بواسطة Chromium WebView.
- Cairo وRTL والنص المتجهي القابل للتحديد/النسخ محفوظة.
- زر PDF يفتح شاشة Android الرسمية للطباعة؛ اختر **Save as PDF / حفظ بتنسيق PDF**.
- لا يوجد html2canvas ولا 300 DPI ولا Raster page images.
- لا استخدام لـ hidden APIs أو reflection.

هذا الحل يفضل الاستقرار والتوافق مع Android 13–16 وCapacitor 8 على الحفظ المباشر عبر API غير عامة.
