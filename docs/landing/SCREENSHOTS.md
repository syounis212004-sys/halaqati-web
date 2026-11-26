# مصدر لقطات الواجهة التعريفية

الأصول المحزومة: `web-src/public/landing/shots/` (AVIF وWebP). البيان `web-src/src/landing/shots-manifest.json` والنقاط `pins.json`.

## إعادة التوليد
1. انسخ حزمة المصحف المولَّدة محليًا إلى `web-src/public/dk/` (مستبعدة من git) ثم `npm run build`.
2. `SHOTS_RAW=/path/raw node scripts/landing-shots.mjs` يولّد PNG ويقيس النقاط (`pins.json`).
3. `python3 scripts/landing-shots-pack.py /path/raw <app>/build/preview` يحزم الصور ويكتب البيان.

## الويب (22 لقطة): `scripts/landing-shots.mjs`
تطبيق الويب الحقيقي، بيانات من `landing-shots-data.mjs` و`landing-shots-lib.mjs` (أسماء مثل «طالب تجريبي»، بريد `example.invalid`، أرقام توضيحية)، `db.rpc`/`db.from` مستبدلان وكل طلب خارجي محجوب، اختبار `landing-gallery.test.mjs` يفحص أن الأسماء توضيحية.
| الدور | اللقطات |
|---|---|
| مسؤول (سطح مكتب) | `web-admin-home`, `-halaqas`, `-users`, `-contests`, `-support`, `-certificates`, `-home-dark` |
| محفّظ (جوال) | `web-teacher-home`, `-roster`, `-plans`, `-students`, `-mushaf-page`, `-mushaf-surah`, `-mushaf-dark`, `-home-dark` |
| مشرف | `web-supervisor-staff` |
| ولي أمر | `web-guardian-profile`, `-ranking`, `-contribute`, `-profile-dark` |
| مانح | `web-donor-home`, `-support` |
المصحف: حزمة DigitalKhatt الحقيقية في المتصفح مع علامات مضافة بالنقر.

## أندرويد (5 لقطات): معاينات اختبارات Compose
`gradle --offline :app:testDebugUnitTest --tests '*DkPagePreviewTest'` مع `HALAQATI_PREVIEW=1` (الملفات في `app/build/preview`، ولم يُعدَّل أي كود في halaqati-app).
| المعرّف | ملف المعاينة | الاختبار |
|---|---|---|
| `android-mushaf-light` / `-dark` | `mushaf_light_411` / `mushaf_dark_411` | معاينات المصحف |
| `android-mushaf-surah` | `dk_ui_p511` | `DkPagePreviewTest.page511SuraStart` |
| `android-mushaf-jump` | `dk_ui_jump_page` | `DkPagePreviewTest.jumpPageTab` |
| `android-reminder` | `rc114_reminder_light` | معاينة التذكير RC114 |

## ما لم يُعرض عن قصد
معاينات `HalaqaCardPreviewTest` و`PremiumUiPreviewTest` ولّدتُها لكن بطاقات الحلقات فيها **أسماء حقيقية** لأشخاص وحلقة، فاستُبعدت كليًا (قائمة السماح في `landing-shots-pack.py`). لا توجد معاينات Compose لباقي شاشات أندرويد (الرئيسية والجلسات والخطط)، فلم تُزيَّف.

## ملاحظة
تذييل الشريط الجانبي في لقطات سطح المكتب يحمل سطر «Designed by» الذي يظهره التطبيق نفسه في كل شاشاته، وهو ليس بيانات مستخدمين.
