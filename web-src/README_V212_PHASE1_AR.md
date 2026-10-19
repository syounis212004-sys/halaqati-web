# حلقتي v2.12.4 — النسخة المستقرة الحالية

هذه النسخة **لا تعيد كتابة منطق التطبيق دفعة واحدة**. الهدف هو نقل التطبيق بأقل مخاطرة من ملف HTML ضخم إلى بنية قابلة للصيانة والبناء الموحد.

## ما تم إنجازه

- Vite أصبح أداة البناء الرسمية للويب وAndroid.
- `index.html` أصبح هيكل الصفحة فقط.
- CSS انتقل إلى `src/styles/app.css`.
- منطق v2.11 محفوظ في `src/legacy/app.js` كمرحلة انتقالية، ويتم إخراجه كملف asset مستقل ذي hash.
- ملفات Core حقيقية في `src/core/`.
- بداية تقسيم Features إلى `reports`, `import`, `ocr`.
- Supabase + خط Cairo + بيانات صفحات المصحف تعد Core وتجهز محلياً قبل البناء.
- XLSX / html2canvas / jsPDF / Mammoth / PDF.js / Tesseract لم تعد ضمن Startup؛ تُحمّل فقط عند الحاجة.
- Vite/Workbox يعطي الملفات الأساسية hashes ويزيل الكاش القديم ويعرض تنبيه "تحديث الآن" عند وجود إصدار جديد.
- نفس `npm run build` ينتج `dist/` الذي يستخدمه GitHub Pages وCapacitor، أي مصدر واحد للويب والـAPK.

## أوامر البناء

```bash
npm install
npm run build
npx cap add android   # أول مرة فقط
npx cap sync android
```

## ملاحظة مهمة

بنية Vite/Capacitor الحالية ثابتة، وv2.12.4 يركز على تثبيت التقارير والتصدير بدون تغيير بقية منطق النظام.

## GitHub Action الموحّد

الملف `build-halaqati-v2.12.4.yml` يبني من **نفس المصدر** ثلاثة Artifacts:

1. `Halaqati-v2.12.4-web` — ملفات الموقع الجاهزة.
2. `Halaqati-v2.12.4-signed-apk` — APK موقّع.
3. `Halaqati-v2.12.4-publish-update` — `Halaqati-latest.apk` + `version.json`.

وقبل بناء APK يشغّل فحص Regression + فحص Browser حقيقي لـ html2canvas للتأكد أن صفحات PDF الناتجة ليست فارغة وأن صفوف الجدول لا تضيع أثناء التقسيم.


## v2.13.0 Phase 1
تم فصل محرك التقارير/PDF الحديث إلى `src/features/reports/runtime.js` مع الحفاظ على نفس السلوك واختبارات Regression إضافية.
