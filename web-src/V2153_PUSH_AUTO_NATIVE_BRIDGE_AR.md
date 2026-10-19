# حلقتي v2.15.4 — Push Auto Native Bridge

هذه النسخة تعالج حالة بقاء Push في «بانتظار رمز FCM» رغم أن Firebase و`google-services.json` صحيحان.

## ما تغير
- أضيف جسر Android Native مستقل باسم `HalaqatiPushBridge` يقرأ رمز FCM مباشرة من `FirebaseMessaging` بدل الاعتماد فقط على حدث `registration` في Capacitor.
- إذا لم تكن `FirebaseApp` مهيأة، يحاول الجسر تهيئتها من موارد `google-services.json` ثم يطلب الرمز.
- تم تفعيل FCM Auto Init صراحةً.
- تسجيل Push يبدأ تلقائياً بعد تسجيل الدخول وعند رجوع الإنترنت.
- إذا كان Android يحتاج إذن الإشعارات، يطلبه التطبيق تلقائياً مرة واحدة عبر نافذة النظام.
- زر «اختبار الإشعار» لم يعد يطلب منك تفعيل Push يدوياً أولاً؛ يحاول تهيئة Push وتسجيل الجهاز ثم يرسل الاختبار.
- استدعاء Capacitor `register()` أصبح غير حاجز للواجهة؛ حتى لو تأخر أو لم يُرجع Promise فلن يعلق الزر.
- بقي مسار Capacitor الرسمي كـFallback واستقبال الإشعارات، مع جسر FCM المباشر كمسار أكثر ثباتاً لاستخراج الرمز.

## الاختبارات المضافة
1. `PUSH_AUTO_V2153_CHECK_PASS`: يفحص وجود الجسر ومسار الاستعادة والتسجيل التلقائي.
2. `PUSH_AUTO_V2153_VM_PASS`: يحاكي حالة أن `PushNotifications.register()` لا ينتهي أبداً، ويتأكد أن التطبيق يحصل على رمز من الجسر المباشر ويسجله في الخادم ثم يرسل Test Push.
3. GitHub Action يربط الجسر Native فعلياً بعد `cap sync` ويتأكد أن Gradle عالج `google-services.json`.
4. عند وجود إعداد Firebase، GitHub Action يشغّل **Android 14 virtual device (Google APIs)** ويطلب رمز FCM حقيقياً من Firebase داخل اختبار Instrumentation. لا يكتمل Build النهائي إذا فشل هذا الاختبار.

## ما لم يتغير
لم يتم تعديل منطق التقارير/PDF أو الجلسات أو الطلاب. ملفات:
- `src/features/reports/runtime.js`
- `src/features/sessions/runtime.js`
- `src/features/students/runtime.js`
مطابقة وظيفياً وملفياً للنسخة v2.15.2.

## بعد البناء
إذا مرّت مرحلة `Android 14 virtual-device real FCM token smoke test` باللون الأخضر، نزّل `Halaqati-v2.15.4-signed-apk` وثبّته فوق التطبيق الحالي بدون حذف البيانات. عند فتح التطبيق والاتصال بالإنترنت، يجب أن يسجل Push تلقائياً. بعدها زر «اختبار الإشعار» يرسل الاختبار مباشرة.
