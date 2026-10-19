# حلقتي v2.15.5 — إصلاح جذري لتسجيل Push

- تمت ترقية Firebase Messaging من 25.0.1 إلى 25.1.1.
- تم إيقاف مسار `FirebaseMessaging.getToken()` القديم في الجسر المباشر.
- التسجيل الآن يستخدم `FirebaseMessaging.register()` ثم Firebase Installation ID (FID).
- لا يوجد `FirebaseApp.initializeApp()` يدوي داخل الجسر؛ يعتمد التطبيق على `FirebaseInitProvider` و`google-services.json`.
- الخادم يدعم الآن إرسال FCM إلى `fid` أو إلى `token` للأجهزة القديمة.
- باقي النظام (PDF، الجلسات، Offline، الطلاب) لم يتغير وظيفياً.
