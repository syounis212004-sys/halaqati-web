# تشغيل حلقتي كـ PWA على iPhone / Android

1. ارفع محتويات هذا المجلد إلى استضافة Static HTTPS حقيقية مثل GitHub Pages أو Netlify أو Vercel.
2. لا تستخدم Supabase Edge Function لاستضافة index.html؛ Edge Functions تحول HTML في GET إلى text/plain.
3. بعد ظهور رابط الموقع النهائي، أضفه في:
   Supabase Dashboard > Authentication > URL Configuration > Redirect URLs
   أضف الرابط الدقيق للموقع، مثال:
   https://YOUR-USER.github.io/YOUR-REPO/
4. Google Cloud لا يحتاج Redirect جديد للموقع؛ أبقِ Authorized redirect URI الخاص بـ Supabase:
   https://xlxzwucqdtggkfwwqibk.supabase.co/auth/v1/callback
5. على iPhone:
   افتح رابط PWA في Safari > Share > Add to Home Screen.

ملاحظة:
ملف HTML المحلي file:// يدعم البريد/كلمة المرور لكنه لا يستطيع استقبال OAuth من Google.
Google يعمل من رابط HTTPS المنشور.


## ملاحظة تحديث 2.8.0
هذه الحزمة تستخدم أحدث واجهة 2.8.0، بما فيها الحذف النهائي للجلسة وتحديث التقارير والترتيب بعد الحذف.
عند تحديث الموقع لاحقاً ارفع الملفات الجديدة فوق القديمة؛ service worker سيستخدم cache جديد.


## 2.8.0
أضيف حذف الخطة الشهرية والتسميع المنفرد وبيانات الطالب من جلسة واحدة، مع تحديث الترتيب والتقارير بعد الحذف.


## نظام تحديث APK
اترك version.json في جذر halaqati-web. عند نشر APK جديد، ارفع Halaqati-latest.apk وversion.json الناتجين من Artifact الخاص بالبناء الموقّع.


## v2.8.1
- إصلاح ظهور الخطط الشهرية المضافة أمام الطلاب.
- عرض أهداف الخطة والتقدم مع أزرار التعديل والحذف.
- هذه الحزمة لا تحتوي version.json عمداً. اترك version.json الحالي في GitHub Pages كما هو، ثم بعد نجاح بناء APK v2.8.1 ارفع version.json وHalaqati-latest.apk من Artifact الخاص بالتحديث.
