# حلقتي v2.15.7 — Official Capacitor Push

هذه النسخة تلغي جميع تجارب Push المخصصة السابقة وتعود إلى المسار الرسمي لـ Capacitor 8:

- `@capacitor/push-notifications` الإصدار 8.1.2 فقط.
- لا يوجد `halaqati-push-bridge` ولا `HalaqatiPushBridge` ولا Custom Java Plugin.
- Android يستخدم حدث `registration` الرسمي؛ `token.value` هو FCM registration token.
- يُحفظ التوكن في جدول `user_devices.push_token` الموجود مسبقًا.
- `halaqati-notify` يرسل عبر FCM HTTP v1 باستخدام `message.token`.
- التسجيل تلقائي بعد تسجيل الدخول؛ المستخدم فقط يمنح إذن الإشعارات على Android عند الحاجة.
- `presentationOptions` تبقي alert/sound مفعّلين لكي يظهر إشعار النظام أيضًا أثناء وجود التطبيق في الواجهة عندما يسمح Android بذلك.

## ما لم يتغير
ملفات الجلسات، الطلاب، Offline، التقارير وPDF لم يتم تعديل منطقها.

## إعداد Firebase المطلوب
يبقى كما هو: `google-services.json` الصحيح للحزمة `com.mohammedsamir.halaqati` داخل Build Secret، و`FIREBASE_SERVICE_ACCOUNT_JSON` في Supabase Edge Functions.
