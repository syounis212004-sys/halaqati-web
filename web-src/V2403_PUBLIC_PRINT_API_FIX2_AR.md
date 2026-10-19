# Halaqati v2.40.3 — Public Print API Regression Fix 2

هذا الإصلاح لا يغيّر محرك PDF ولا الواجهة. أصل المشكلة كان في اختبار التوافق v2.40.2 داخل CI، إذ بقي يتوقع مسار `MediaStore.Downloads` القديم رغم أن v2.40.3 انتقل عمدًا إلى Android Public PrintManager API.

تم تحديث الاختبار ليتحقق من المسار الصحيح في v2.40.3:
- Chromium WebView `createPrintDocumentAdapter`.
- Android `PrintManager` و `printManager.print`.
- A4 عبر `PrintAttributes.MediaSize.ISO_A4`.
- منع استخدام `LayoutResultCallback` و `WriteResultCallback` المخفيين.

لا تغيير في النسخة، البيانات، Supabase، الخطط، Live Halaqa، أو تصميم PDF.
