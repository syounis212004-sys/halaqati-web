# إعداد Firebase Push — حلقتي v2.15.2 Crash-Safe

هذه النسخة لا تستدعي PushNotifications عند تشغيل التطبيق إلا إذا كان APK مبنياً فعلاً بملف Firebase صالح. لذلك التطبيق يفتح ويعمل حتى بدون Firebase، ومركز الإشعارات داخل التطبيق يبقى فعالاً.

## أولا: إعداد تطبيق Android في Firebase
1. افتح Firebase Console وسجّل الدخول.
2. أنشئ مشروعاً جديداً أو استخدم مشروعاً مناسباً للتطبيق.
3. أضف Android App.
4. اكتب Package name بالضبط: `com.mohammedsamir.halaqati`
5. أكمل التسجيل ثم نزّل `google-services.json`.
6. لا ترفع `google-services.json` إلى مستودع GitHub العام.

## ثانيا: ضع google-services.json في GitHub Secret
الـWorkflow v2.15.2 يدعم طريقتين. الأسهل على الهاتف هي JSON الخام:

Repository البناء → Settings → Secrets and variables → Actions → New repository secret

اسم Secret:
`HALAQATI_FIREBASE_GOOGLE_SERVICES_JSON`

القيمة:
افتح `google-services.json` كنص، انسخ محتواه كاملاً من أول `{` إلى آخر `}` والصقه كقيمة للـSecret.

بديل قديم مدعوم أيضاً:
`HALAQATI_FIREBASE_GOOGLE_SERVICES_JSON_BASE64`

يكفي واحد منهما فقط، والأفضل JSON الخام.

## ثالثا: Service Account للإرسال من Supabase
هذا مختلف عن google-services.json. وهو يبقى على الخادم ولا يدخل APK.

1. من Firebase/Google Cloud افتح Service Accounts للمشروع.
2. أنشئ Private Key بصيغة JSON للخدمة التي ستستخدم FCM HTTP v1.
3. في Supabase Dashboard افتح Edge Functions / Secrets.
4. أنشئ Secret باسم:
   `FIREBASE_SERVICE_ACCOUNT_JSON`
5. الصق محتوى Service Account JSON كاملاً.
6. لا تضع هذا الملف في GitHub أو داخل التطبيق.

Edge Function `halaqati-notify` مجهزة لاستخدام هذا الـSecret.

## رابعا: ابنِ v2.15.2
بعد إضافة GitHub Secret شغّل Workflow `build-halaqati-v2.15.2.yml`.
راقب المرحلتين:
- `Detect Firebase Push configuration`
- `Install validated Firebase Android config`

يجب أن يظهر أن Firebase configured وأن package هو `com.mohammedsamir.halaqati`.

## خامسا: التثبيت والاختبار
1. ثبّت `Halaqati-v2.15.2-signed-apk` فوق النسخة الحالية بدون حذف التطبيق أو Clear Data.
2. افتح التطبيق. يجب ألا يحدث Crash حتى لو كانت الإشعارات غير مفعلة بعد.
3. ادخل الإعدادات → الإشعارات.
4. اضغط `تفعيل Push على هذا الجهاز`.
5. وافق على إذن إشعارات Android.
6. اضغط `اختبار الإشعار`.
7. جرّب بعد ذلك إرسال إشعار من مسؤول النظام أو مشرف الحلقة إلى ولي أمر مرتبط بطالب.

## لماذا هذه النسخة Crash-Safe؟
- لا يوجد Static Import للـPush plugin عند startup.
- تحميل الـPlugin Lazy فقط إذا الـBuild يحمل Firebase صحيحاً.
- عند فتح التطبيق لأول مرة لا نطلب Permission تلقائياً؛ الطلب يحصل عند ضغط المستخدم على تفعيل Push.
- أي خطأ في تحميل أو تسجيل Push محاط بـ try/catch ولا يمنع تشغيل التطبيق.
- إذا Firebase غير موجود، يظهر داخل الإعدادات أن Push غير مهيأ، بينما باقي التطبيق ومركز الإشعارات يعملان.
