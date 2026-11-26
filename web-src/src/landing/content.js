/* Single source of truth for landing copy. Every feature listed here was checked against the codebase
   (see `proof` – the file that implements it); scripts/landing-content.test.mjs re-checks that each proof file still exists. */
export const SITE_URL = 'https://syounis212004-sys.github.io/halaqati-web/';

export const FEATURES = [
  { id: 'halaqas', icon: 'users', title: 'إدارة الحلقات', text: 'أنشئ الحلقات وأسند المحفّظين والمشرفين وصنّف الطلاب في فئات.', proof: 'src/features/master-data/runtime.js', cls: 'w3' },
  { id: 'students', icon: 'graduation', title: 'الطلاب', text: 'ملف لكل طالب، وإضافة سريعة، واستيراد جماعي من ملفات Excel.', proof: 'src/features/students/runtime.js', cls: 'w3' },
  { id: 'recitation', icon: 'mic', title: 'الحفظ والتسميع', text: 'سجّل التسميع في ثوانٍ بتقييم وملاحظات، ويُحفظ حتى لو انقطع الإنترنت ثم يُزامَن تلقائيًا.', proof: 'src/features/sessions/runtime.js', cls: 'w4 tall' },
  { id: 'plans', icon: 'route', title: 'الخطط الذكية', text: 'خطط حفظ ومراجعة تُحسب بالصفحات وتنبّه عند التأخر.', proof: 'src/features/plans/engine.js', cls: 'w2' },
  { id: 'attendance', icon: 'calendar', title: 'الحضور', text: 'حضور وغياب واستئذان لكل جلسة.', proof: 'src/features/sessions/runtime.js', cls: 'w2' },
  { id: 'reports', icon: 'chart', title: 'التقارير', text: 'تقارير للطالب والحلقة والإشراف، وتصدير PDF بخط عربي سليم.', proof: 'src/features/reports/runtime.js', cls: 'w3' },
  { id: 'guardians', icon: 'heart', title: 'متابعة أولياء الأمور', text: 'يرى ولي الأمر تقدّم أبنائه وخططهم وتصله التنبيهات.', proof: 'src/features/guardian/runtime.js', cls: 'w3' },
  { id: 'mushaf', icon: 'book', title: 'المصحف الإلكتروني', text: 'مصحف بخط المدينة يعمل بلا إنترنت مع انتقال سريع إلى المقرر.', proof: 'src/features/native/mushaf.js', cls: 'w2' },
  { id: 'certificates', icon: 'award', title: 'الشهادات والتكريم', text: 'مركز شهادات يصدر شهادات PDF جاهزة للطباعة.', proof: 'src/features/certificates/runtime.js', cls: 'w2' },
  { id: 'permissions', icon: 'shield', title: 'الصلاحيات', text: 'لكل دور صفحاته وإجراءاته، والحسابات الجديدة تنتظر اعتماد المسؤول.', proof: 'src/features/rc27/scope.js', cls: 'w2' },
  { id: 'contests', icon: 'trophy', title: 'مسابقات المانحين', text: 'مسابقات للحلقات والفئات تُعرض نتائجها للمانحين والإدارة.', proof: 'src/features/rc50/donor.js', cls: 'w3' },
  { id: 'sponsorship', icon: 'handshake', title: 'الكفالة', text: 'بطاقات دعم مفتوحة يكفلها المانحون، مع متابعة الوصول والأثر.', proof: 'src/features/rc50/donor.js', cls: 'w3' },
];

/* Roles = the gallery tabs. `needs` are concrete reasons this role needs the app, each derived from a feature that exists
   (see FEATURES.proof). `screens` are ids from SCREENS (real captures); android ones exist only where a real Compose preview does. */
export const ROLES = [
  { id: 'admin', label: 'مسؤول النظام', icon: 'shield', lead: 'تحكّم كامل في المركز من مكان واحد، بلا أوراق متفرقة.', needs: [
    'يعتمد كل حساب جديد قبل أن يدخل، ويربط ولي الأمر بابنه.',
    'ينشئ الحلقات والفئات ويسند المحفّظين والمشرفين.',
    'يستورد الطلاب من ملفات Excel بدل إدخالهم واحدًا واحدًا.',
    'يدير المسابقات وبطاقات الدعم والمانحين، ويصدر الشهادات PDF.'],
    screens: ['web-admin-home', 'web-admin-halaqas', 'web-admin-users', 'web-admin-contests', 'web-admin-support', 'web-admin-certificates', 'web-admin-home-dark'] },
  { id: 'teacher', label: 'المحفّظ', icon: 'mic', lead: 'يومك في الحلقة أخفّ: افتح الجلسة وسمّع وسجّل.', needs: [
    'يسجّل التسميع والتقييم والملاحظات أثناء الجلسة نفسها، ولو انقطع الإنترنت.',
    'يرى مقرر كل طالب اليومي بخطة حفظ ومراجعة محسوبة بالصفحات.',
    'يسمّع من المصحف مباشرة ويعلّم الأخطاء والتلقينات فيظهر التقدير فورًا.',
    'يُحضّر الطلاب ويصدر الشهادات من الجوال.'],
    screens: ['web-teacher-home', 'web-teacher-roster', 'web-teacher-plans', 'web-teacher-students', 'web-teacher-mushaf-page', 'web-teacher-mushaf-surah', 'web-teacher-mushaf-dark', 'android-mushaf-light', 'android-mushaf-surah', 'android-mushaf-dark', 'android-mushaf-jump', 'android-reminder'] },
  { id: 'supervisor', label: 'المشرف', icon: 'eye', lead: 'رؤية واضحة لما يجري في كل حلقة تشرف عليها.', needs: [
    'يرى أداء كل محفّظ: التزامه بالحضور وتغطية التسميع وإنهاء الجلسات.',
    'يعرف من يحتاج متابعة قبل أن تتراكم المشكلة.',
    'يسجّل زيارته ويرسل تنبيهًا للمحفّظ من اللوحة نفسها.',
    'يقارن بين المحفّظين والحلقات ويصدر تقارير الإشراف PDF.'],
    screens: ['web-supervisor-staff'] },
  { id: 'guardian', label: 'ولي الأمر', icon: 'heart', lead: 'اطمئنّ على أبنائك دون أن تنتظر نهاية الأسبوع.', needs: [
    'يعرف هل حضر ابنه اليوم وما الذي سمّعه وجودة آخر تسميع.',
    'يتابع تقدّم الحفظ يوميًا برسم بياني، وما تبقّى من خطته.',
    'يرى ترتيب ابنه داخل فئته وحلقته دون كشف أسماء الآخرين.',
    'يساهم بكفالة حلقة أو جوائز طلابها ويتواصل مع الإدارة.'],
    screens: ['web-guardian-profile', 'web-guardian-ranking', 'web-guardian-contribute', 'web-guardian-profile-dark'] },
  { id: 'donor', label: 'المانح', icon: 'handshake', lead: 'اعرف أين يصل دعمك وما أثره.', needs: [
    'يكفل بطاقات الدعم المفتوحة ويتابع وصولها.',
    'يتعرّف على الطلاب المكرَّمين كل شهر.',
    'يطّلع على مسابقات الحلقات ونتائجها.',
    'يتواصل مع الإدارة من داخل التطبيق.'],
    screens: ['web-donor-home', 'web-donor-support'] },
];

/* Three equal entry paths shown right after the hero. */
export const TRACKS = [
  { id: 'center', role: 'admin', title: 'الإدارة والمركز', who: 'مسؤول النظام ومدير المركز والمانحون', shot: 'web-admin-home', needs: ['اعتماد الحسابات وربط أولياء الأمور بأبنائهم', 'إدارة الحلقات والفئات والمسابقات والكفالات', 'شهادات PDF وتقارير جاهزة للطباعة'], cta: 'شاهد شاشات الإدارة' },
  { id: 'teaching', role: 'teacher', title: 'المحفّظ والمشرف', who: 'من يسمّع ومن يتابع الحلقات', shot: 'web-teacher-roster', needs: ['جلسة اليوم والتسميع والتقييم في ثوانٍ', 'مصحف بخط المدينة بعلامات الخطأ والتلقين', 'خطط ذكية ومتابعة أداء المحفّظين'], cta: 'شاهد شاشات المحفّظ' },
  { id: 'family', role: 'guardian', title: 'ولي الأمر', who: 'من يتابع ابنه من البيت', shot: 'web-guardian-profile', needs: ['حضور اليوم وما سُمّع وجودته', 'رسم تقدّم الحفظ وترتيب الابن في فئته', 'كفالة الحلقات والتواصل مع الإدارة'], cta: 'شاهد شاشات ولي الأمر' },
];

/* Every captured screen: web ones come from the real app with fictional data (scripts/landing-shots.mjs),
   android ones are real Jetpack Compose preview renders (app tests, HALAQATI_PREVIEW=1). */
export const SCREENS = [
  { id: 'web-admin-home', platform: 'web', role: 'admin', device: 'desktop', title: 'لوحة الإدارة', caption: 'الرئيسية: جلسة اليوم والاختصارات وقائمة كل الأقسام.', alt: 'لقطة شاشة للوحة تحكم مسؤول النظام في حلقاتي على الحاسوب' },
  { id: 'web-admin-halaqas', platform: 'web', role: 'admin', device: 'desktop', title: 'الحلقات والفئات', caption: 'بطاقة لكل حلقة فيها الطلاب والفئات والمحفّظون والمشرفون.', alt: 'لقطة شاشة لصفحة إدارة الحلقات والفئات' },
  { id: 'web-admin-users', platform: 'web', role: 'admin', device: 'desktop', title: 'الحسابات والصلاحيات', caption: 'الحسابات الجديدة بانتظار الاعتماد، مع ربط أولياء الأمور بالطلاب.', alt: 'لقطة شاشة لصفحة اعتماد الحسابات وصلاحياتها' },
  { id: 'web-admin-contests', platform: 'web', role: 'admin', device: 'desktop', title: 'المسابقات', caption: 'مسابقات مقترحة تنتظر قرار الإدارة.', alt: 'لقطة شاشة لصفحة المسابقات وقرار الاعتماد' },
  { id: 'web-admin-support', platform: 'web', role: 'admin', device: 'desktop', title: 'الدعم والمانحون', caption: 'بطاقات دعم مفتوحة وتتبّع الكفالات.', alt: 'لقطة شاشة لصفحة الدعم والمانحين وبطاقات الدعم' },
  { id: 'web-admin-certificates', platform: 'web', role: 'admin', device: 'desktop', title: 'مركز الشهادات', caption: 'معاينة الشهادة قبل إصدارها فرديًا أو جماعيًا PDF.', alt: 'لقطة شاشة لمركز الشهادات مع معاينة شهادة' },
  { id: 'web-admin-home-dark', platform: 'web', role: 'admin', device: 'desktop', dark: true, title: 'الوضع الداكن', caption: 'لوحة الإدارة بالوضع الداكن.', alt: 'لقطة شاشة للوحة الإدارة بالوضع الداكن' },
  { id: 'web-teacher-home', platform: 'web', role: 'teacher', device: 'phone', title: 'الرئيسية', caption: 'افتح جلسة اليوم واختر من الاختصارات.', alt: 'لقطة شاشة للصفحة الرئيسية للمحفّظ على الجوال' },
  { id: 'web-teacher-roster', platform: 'web', role: 'teacher', device: 'phone', title: 'جلسة التسميع', caption: 'حضور وتسميع كل طالب وعدّادات الجلسة.', alt: 'لقطة شاشة لجلسة تسميع فيها طلاب تجريبيون وحالة كل منهم' },
  { id: 'web-teacher-plans', platform: 'web', role: 'teacher', device: 'phone', title: 'الخطط الذكية', caption: 'مقرر يومي محسوب وحالة متابعة لكل طالب.', alt: 'لقطة شاشة للخطط الذكية وحالة متابعة كل طالب' },
  { id: 'web-teacher-students', platform: 'web', role: 'teacher', device: 'phone', title: 'الطلاب', caption: 'بحث وتصنيف الطلاب بحسب الحلقة.', alt: 'لقطة شاشة لقائمة الطلاب والبحث' },
  { id: 'web-teacher-mushaf-page', platform: 'web', role: 'teacher', device: 'phone', title: 'المصحف: صفحة', caption: 'علامات الخطأ والتلقين على الكلمات وتقدير فوري.', alt: 'لقطة شاشة لصفحة مصحف بخط المدينة عليها علامات تسميع' },
  { id: 'web-teacher-mushaf-surah', platform: 'web', role: 'teacher', device: 'phone', title: 'المصحف: بداية سورة', caption: 'ترويسة السورة كما في المصحف المطبوع.', alt: 'لقطة شاشة لصفحة بداية سورة في المصحف الإلكتروني' },
  { id: 'web-teacher-mushaf-dark', platform: 'web', role: 'teacher', device: 'phone', dark: true, title: 'المصحف: داكن', caption: 'قراءة مريحة ليلًا مع بقاء العلامات واضحة.', alt: 'لقطة شاشة للمصحف الإلكتروني بالوضع الداكن' },
  { id: 'android-mushaf-light', platform: 'android', role: 'teacher', device: 'phone', title: 'المصحف على أندرويد', caption: 'شاشة التسميع في تطبيق أندرويد بأدوات اللمس والتظليل.', alt: 'لقطة من تطبيق أندرويد لصفحة مصحف مع أدوات التسميع' },
  { id: 'android-mushaf-surah', platform: 'android', role: 'teacher', device: 'phone', title: 'بداية سورة', caption: 'صفحة بداية سورة في تطبيق أندرويد.', alt: 'لقطة من تطبيق أندرويد لصفحة بداية سورة' },
  { id: 'android-mushaf-dark', platform: 'android', role: 'teacher', device: 'phone', dark: true, title: 'الوضع الداكن', caption: 'المصحف بالوضع الداكن على أندرويد.', alt: 'لقطة من تطبيق أندرويد للمصحف بالوضع الداكن' },
  { id: 'android-mushaf-jump', platform: 'android', role: 'teacher', device: 'phone', title: 'الانتقال السريع', caption: 'انتقل بالصفحة أو السورة أو الجزء وإلى المقرر.', alt: 'لقطة من تطبيق أندرويد لنافذة الانتقال بين صفحات المصحف' },
  { id: 'android-reminder', platform: 'android', role: 'teacher', device: 'phone', title: 'التذكير', caption: 'تذكير محلي بالتطبيق بأيام وساعة تختارها.', alt: 'لقطة من تطبيق أندرويد لإعداد تذكير الحلقة' },
  { id: 'web-supervisor-staff', platform: 'web', role: 'supervisor', device: 'phone', title: 'متابعة المحفّظين', caption: 'أداء كل محفّظ وتسجيل الزيارات والتنبيهات.', alt: 'لقطة شاشة لمتابعة أداء المحفّظين للمشرف' },
  { id: 'web-guardian-profile', platform: 'web', role: 'guardian', device: 'phone', title: 'ملف الابن', caption: 'حالة اليوم وتطوّر الحفظ بالرسم.', alt: 'لقطة شاشة لملف متابعة الابن لولي الأمر' },
  { id: 'web-guardian-ranking', platform: 'web', role: 'guardian', device: 'phone', title: 'الترتيب', caption: 'ترتيب الابن داخل فئته وحلقته.', alt: 'لقطة شاشة لترتيب الأبناء وإحصائياتهم' },
  { id: 'web-guardian-contribute', platform: 'web', role: 'guardian', device: 'phone', title: 'المساهمة والكفالة', caption: 'فرص دعم الحلقات وجوائز الطلاب.', alt: 'لقطة شاشة لصفحة المساهمة والكفالة لولي الأمر' },
  { id: 'web-guardian-profile-dark', platform: 'web', role: 'guardian', device: 'phone', dark: true, title: 'الوضع الداكن', caption: 'ملف الابن بالوضع الداكن.', alt: 'لقطة شاشة لملف الابن بالوضع الداكن' },
  { id: 'web-donor-home', platform: 'web', role: 'donor', device: 'phone', title: 'رئيسية المانح', caption: 'ملخص حلقتك والمكرَّمون والدعم.', alt: 'لقطة شاشة للصفحة الرئيسية للمانح' },
  { id: 'web-donor-support', platform: 'web', role: 'donor', device: 'phone', title: 'الدعم والكفالات', caption: 'بطاقات الدعم المفتوحة وكفالاتك.', alt: 'لقطة شاشة لصفحة الدعم والكفالات للمانح' },
];

/* Hotspots on the android captures (percent of the picture). Web hotspots are measured from the real DOM: src/landing/pins.json. */
export const ANDROID_PINS = {
  'android-mushaf-light': [{ x: 50, y: 3.4, label: 'التنقل', text: 'ترقيم الصفحات وزر «إلى المقرر» والإغلاق.' }, { x: 50, y: 7.6, label: 'التقدير', text: 'تقدير التسميع يظهر فور وضع العلامات.' }, { x: 50, y: 40, label: 'علامات على الكلمات', text: 'علامات الخطأ والتلقين على الكلمات نفسها.' }, { x: 50, y: 93, label: 'أدوات التسميع', text: 'لمس وتظليل وتراجع وعدّاد الأخطاء والتلقين.' }],
  'android-mushaf-surah': [{ x: 50, y: 21, label: 'بداية السورة', text: 'ترويسة السورة كما في المصحف المطبوع.' }, { x: 50, y: 93, label: 'أدوات التسميع', text: 'الأدوات نفسها أسفل الصفحة.' }],
  'android-mushaf-dark': [{ x: 50, y: 40, label: 'الوضع الداكن', text: 'قراءة مريحة ليلًا مع بقاء العلامات واضحة.' }, { x: 50, y: 93, label: 'أدوات التسميع', text: 'الأدوات نفسها في الوضعين.' }],
  'android-mushaf-jump': [{ x: 50, y: 16, label: 'ضمن المقرر', text: 'صفحات المقرر الحالي تظهر للانتقال إليها مباشرة.' }, { x: 50, y: 28, label: 'ثلاث طرق', text: 'انتقل بالصفحة أو السورة أو الجزء.' }, { x: 50, y: 50, label: 'العلامات المرجعية', text: 'ارجع إلى صفحاتك المحفوظة.' }],
  'android-reminder': [{ x: 50, y: 6, label: 'تذكير محلي', text: 'فعّل التذكير ليظهر على جهازك.' }, { x: 50, y: 17, label: 'الأيام', text: 'اختر أيام الحلقة.' }, { x: 50, y: 39, label: 'تجربة التذكير', text: 'أرسل تذكيرًا تجريبيًا قبل الاعتماد.' }],
};

/* Mushaf section: only capabilities verified in the code (features/native/dk, mushaf.js, mushaf-jump.mjs) and the release notes. */
export const MUSHAF_POINTS = [
  ['book', 'خط المدينة بجودة الطباعة', 'صفحات المصحف تُرسم محليًا بخط المدينة المعروف، وتعمل بلا إنترنت.'],
  ['mic', 'علامات التسميع على الكلمات', 'المس الكلمة أو ظلّل مقطعًا لتعليمه خطأً أو تلقينًا، مع تراجع وإعادة.'],
  ['award', 'تقدير فوري', 'يُحسب التقدير من الأخطاء والتلقينات فور وضع العلامات.'],
  ['route', 'انتقال سريع', 'بالصفحة أو السورة أو الجزء، أو إلى مقرر الطالب مباشرة.'],
  ['eye', 'تكبير وتقليب', 'تكبير بالقرص أو عجلة الفأرة، وتقليب للصفحات بحركة هادئة.'],
  ['moon', 'وضع داكن', 'قراءة مريحة ليلًا في الويب وأندرويد.'],
];

export const STEPS = [
  ['shield', 'اعتماد الحساب', 'ينشئ المستخدم حسابه، ويعتمده مسؤول النظام قبل الدخول.'],
  ['users', 'تجهيز الحلقات', 'يُنشئ المسؤول الحلقات ويضيف الطلاب والمحفّظين، أو يستورد الطلاب من Excel.'],
  ['mic', 'التسميع اليومي', 'يفتح المحفّظ الجلسة ويسجّل الحضور والتسميع والتقييم.'],
  ['route', 'خطط وتقارير', 'تُحسب الخطط والمتأخرات وتتكوّن التقارير من البيانات المسجّلة.'],
  ['heart', 'متابعة الجميع', 'يتابع ولي الأمر والمشرف والمانح كلٌّ ما يخصّه.'],
];

export const FAQ = [
  ['هل تعمل المنصة بلا إنترنت؟', 'نعم. يُحفظ التسميع والحضور على جهازك أولًا، وتتم مزامنته تلقائيًا عند عودة الاتصال. المصحف الإلكتروني يعمل بلا إنترنت أيضًا.'],
  ['كيف أحصل على حساب؟', 'اضغط «تسجيل الدخول» ثم «إنشاء حساب جديد». لا يُمنح الدخول مباشرة: يراجع مسؤول النظام الطلب ويعتمده أولًا.'],
  ['هل يوجد تطبيق أندرويد؟', 'نعم، يمكنك تنزيل ملف APK من قسم «تحميل التطبيق». كما يمكن تثبيت المنصة من المتصفح كتطبيق ويب.'],
  ['هل يمكن استيراد الطلاب من ملف؟', 'نعم، يوفّر مسؤول النظام «مركز الاستيراد الذكي» لقراءة ملفات Excel قبل اعتماد البيانات.'],
  ['هل يستطيع ولي الأمر متابعة ابنه؟', 'نعم. لولي الأمر حساب خاص يعرض تقدّم أبنائه وخططهم ويستقبل التنبيهات، ولا يرى غير ما يخصّه.'],
  ['هل تصدر التقارير والشهادات؟', 'نعم. تُصدَّر التقارير والشهادات بصيغة PDF بخط عربي سليم وجاهزة للطباعة.'],
  ['هل يمكنني الدخول بحساب Google؟', 'نعم، تدعم شاشة الدخول البريد الإلكتروني وكلمة المرور، والمتابعة باستخدام Google.'],
];
