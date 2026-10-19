# حلقتي v2.15.2 — Crash-Safe Push

إصلاح مخصص لانهيار APK v2.15 عند تشغيل Push بدون Firebase Android config.

## التغيير الوظيفي الوحيد في هذه النسخة
- تحويل `@capacitor/push-notifications` من تحميل مباشر عند Startup إلى Lazy Import محمي.
- APK غير المبني بـ Firebase لا يستدعي أي Native Push API.
- APK المبني بـ Firebase صالح لا يطلب الإذن تلقائياً عند الفتح؛ المستخدم يفعله من الإعدادات مرة واحدة.
- إذا كان Permission ممنوحاً مسبقاً يمكن التسجيل بهدوء بالخلفية.
- أي فشل في Push لا يمنع فتح التطبيق.

## لم يتم تغيير
- Offline Sync / IndexedDB.
- الحلقات والطلاب والفئات.
- الجلسات والحضور والسلوك والتسميع.
- PDF والتقارير والعربية.
- صلاحيات إرسال الإشعارات: مسؤول النظام + مشرف الحلقة كما في v2.15.0.
- Edge Function وقاعدة بيانات الإشعارات.

## بناء Firebase
Workflow v2.15.2 يحدد وجود Firebase قبل Vite Build ويضبط `VITE_HALAQATI_FIREBASE_CONFIGURED` تلقائياً.
يدعم Secret خاماً باسم `HALAQATI_FIREBASE_GOOGLE_SERVICES_JSON` أو Base64 بالاسم السابق.
