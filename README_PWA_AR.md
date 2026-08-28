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


## ملاحظة تحديث v2.7.3
هذه الحزمة تستخدم أحدث واجهة v2.7.3، بما فيها الحذف النهائي للجلسة وتحديث التقارير والترتيب بعد الحذف.
عند تحديث الموقع لاحقاً ارفع الملفات الجديدة فوق القديمة؛ service worker سيستخدم cache جديد.
