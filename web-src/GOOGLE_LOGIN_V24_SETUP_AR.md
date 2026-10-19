# تسجيل Google في حلقتي v2.3

Google Provider في Supabase يبقى مفعلاً كما هو.

الخطوة الوحيدة المطلوبة في Supabase:
Authentication → URL Configuration → Redirect URLs
أضف:
com.mohammedsamir.halaqati://auth/callback

مهم:
- لا تضف هذا الرابط إلى Google Cloud Authorized redirect URIs.
- Google Cloud يبقى فيه فقط رابط Supabase:
  https://xlxzwucqdtggkfwwqibk.supabase.co/auth/v1/callback

تدفق الدخول:
حلقتي → Google → Supabase → com.mohammedsamir.halaqati://auth/callback → يفتح تطبيق حلقتي مباشرة.
