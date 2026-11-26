/* Static, semantic landing markup. Pure string module: the build injects it into index.html (readable before JS, indexable),
   and landing/index.js only hydrates it. Icons are Lucide (ISC licence) paths inlined as one <symbol> sprite. */
import { FEATURES, ROLES, STEPS, FAQ, SITE_URL } from './content.js';

const ICONS = {
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  graduation: '<path d="M21.42 10.92a1 1 0 0 0-.02-1.84L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>',
  mic: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/>',
  route: '<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>',
  calendar: '<path d="M8 2v4M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="m9 16 2 2 4-4"/>',
  chart: '<path d="M3 3v18h18"/><path d="M18 17V9M13 17V5M8 17v-3"/>',
  heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  book: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  award: '<circle cx="12" cy="8" r="6"/><path d="M15.48 12.89 17 22l-5-3-5 3 1.52-9.11"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
  handshake: '<path d="m11 17 2 2a1 1 0 1 0 3-3"/><path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4"/><path d="m21 3 1 11h-2"/><path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3"/><path d="M3 4h8"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  chev: '<path d="m6 9 6 6 6-6"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  pause: '<rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/>',
  phone: '<rect width="14" height="20" x="5" y="2" rx="2"/><path d="M12 18h.01"/>',
  arrow: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  eye: '<path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3"/>',
  bell: '<path d="M10.27 21a2 2 0 0 0 3.46 0"/><path d="M3.26 15.33A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.67C19.41 13.96 18 12.5 18 8a6 6 0 0 0-12 0c0 4.5-1.41 5.96-2.74 7.33"/>',
  file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M8 13h8M8 17h5"/>',
  wifioff: '<path d="M12 20h.01"/><path d="M8.5 16.43a5 5 0 0 1 7 0"/><path d="M5 12.86a10 10 0 0 1 5.17-2.69"/><path d="M19 12.86a10 10 0 0 0-2.01-1.55"/><path d="M2 8.82a15 15 0 0 1 4.18-2.65"/><path d="M22 8.82a15 15 0 0 0-11.29-3.76"/><path d="m2 2 20 20"/>',
};
const ic = (n, c = '') => `<svg class="hl-i ${c}" aria-hidden="true" focusable="false"><use href="#hli-${n}"/></svg>`;
const sprite = `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>${Object.entries(ICONS).map(([k, v]) => `<symbol id="hli-${k}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${v}</symbol>`).join('')}</defs></svg>`;

const NAV = [['hl-home', 'الرئيسية'], ['hl-about', 'عن المنصة'], ['hl-features', 'المميزات'], ['hl-how', 'كيفية الاستخدام'], ['hl-demo', 'استكشاف المنصة'], ['hl-faq', 'الأسئلة الشائعة'], ['hl-app', 'تحميل التطبيق']];

/* mini visuals inside bento tiles: pure CSS, aria-hidden */
const MINI = {
  halaqas: '<div class="hl-mini hl-chips"><i>حلقة الفجر</i><i>حلقة العصر</i><i>حلقة الأشبال</i></div>',
  students: '<div class="hl-mini hl-avatars"><i></i><i></i><i></i><i></i><b>+</b></div>',
  recitation: '<div class="hl-mini hl-rec"><div class="hl-rec-row"><span class="hl-av"></span><span class="hl-bar"><i></i></span><em class="ok">ممتاز</em></div><div class="hl-rec-row"><span class="hl-av"></span><span class="hl-bar"><i></i></span><em class="gd">جيد جدًا</em></div><div class="hl-rec-row"><span class="hl-av"></span><span class="hl-bar"><i></i></span><em class="ok">ممتاز</em></div></div>',
  plans: '<div class="hl-mini hl-track"><span style="--p:.72"></span><span style="--p:.45"></span><span style="--p:.2"></span></div>',
  attendance: '<div class="hl-mini hl-dots"><i class="p"></i><i class="p"></i><i class="a"></i><i class="p"></i><i class="e"></i><i class="p"></i><i class="p"></i></div>',
  reports: '<div class="hl-mini hl-bars"><i style="--h:40%"></i><i style="--h:62%"></i><i style="--h:50%"></i><i style="--h:84%"></i><i style="--h:70%"></i><i style="--h:96%"></i></div>',
  guardians: '<div class="hl-mini hl-ring"><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15"/><circle class="v" cx="18" cy="18" r="15" pathLength="100"/></svg></div>',
  mushaf: '<div class="hl-mini hl-page"><i></i><i></i><i></i><i></i><i></i><i></i></div>',
  certificates: '<div class="hl-mini hl-cert">' + ic('award') + '</div>',
  permissions: '<div class="hl-mini hl-perm"><i class="on"></i><i class="on"></i><i></i><i class="on"></i></div>',
  contests: '<div class="hl-mini hl-podium"><i></i><i></i><i></i></div>',
  sponsorship: '<div class="hl-mini hl-pledge"><i></i><i></i><i></i></div>',
};

const feature = (f) => `<article class="hl-tile ${f.cls}" data-hl-reveal data-feature="${f.id}"><span class="hl-ico">${ic(f.icon)}</span><h3>${f.title}</h3><p>${f.text}</p>${MINI[f.id] || ''}</article>`;

const roleTab = (r, i) => `<button class="hl-tab" role="tab" id="hl-tab-${r.id}" aria-controls="hl-panel-${r.id}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" type="button">${ic(r.icon)}<span>${r.label}</span></button>`;
const rolePanel = (r, i) => `<div class="hl-panel" role="tabpanel" id="hl-panel-${r.id}" aria-labelledby="hl-tab-${r.id}" ${i === 0 ? '' : 'hidden'} tabindex="0"><p class="hl-lead">${r.lead}</p><ul class="hl-rcards">${r.cards.map(([i2, t, d]) => `<li class="hl-rcard">${ic(i2)}<div><h3>${t}</h3><p>${d}</p></div></li>`).join('')}</ul></div>`;

const step = ([i, t, d], n) => `<li class="hl-step" data-hl-reveal><span class="hl-step-n">${ic(i)}<b>${n + 1}</b></span><div><h3>${t}</h3><p>${d}</p></div></li>`;
const faq = ([q, a], i) => `<details class="hl-q" ${i === 0 ? '' : ''} name="hl-faq"><summary><span>${q}</span>${ic('chev', 'hl-chev')}</summary><div class="hl-a"><p>${a}</p></div></details>`;

export function faqJsonLd() {
  return { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) };
}
export function appJsonLd(version) {
  return { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'حلقاتي', applicationCategory: 'EducationalApplication', operatingSystem: 'Web, Android', inLanguage: 'ar', url: SITE_URL, softwareVersion: version, description: 'منصة عربية لإدارة ومتابعة حلقات تحفيظ القرآن الكريم: التسميع والخطط والحضور والتقارير ومتابعة أولياء الأمور.', downloadUrl: SITE_URL + 'Halaqati-latest.apk' };
}

export function landingHtml({ version = '' } = {}) {
  return `${sprite}
<a class="hl-skip" href="#hl-main">انتقل إلى المحتوى</a>
<header class="hl-nav" id="hl-nav"><div class="hl-wrap hl-nav-in">
  <a class="hl-brand" href="#hl-home" aria-label="حلقاتي"><img src="./brand/logo.svg" width="36" height="36" alt=""><span>حلقاتي</span></a>
  <nav class="hl-links" id="hl-links" aria-label="التنقل الرئيسي">${NAV.map(([id, t]) => `<a href="#${id}" data-spy="${id}">${t}</a>`).join('')}</nav>
  <div class="hl-nav-act">
    <button class="hl-iconbtn" id="hl-pause" type="button" aria-label="إيقاف الحركة الزخرفية" aria-pressed="false">${ic('pause')}</button>
    <button class="hl-iconbtn" id="hl-theme"type="button" aria-label="تبديل الوضع الداكن" aria-pressed="false">${ic('moon', 'hl-moon')}${ic('sun', 'hl-sun')}</button>
    <button class="hl-btn hl-btn-solid hl-login" type="button" data-hl-login>تسجيل الدخول</button>
    <button class="hl-iconbtn hl-burger" id="hl-burger" type="button" aria-label="فتح القائمة" aria-expanded="false" aria-controls="hl-links">${ic('menu', 'hl-b-open')}${ic('x', 'hl-b-close')}</button>
  </div>
</div></header>

<main id="hl-main" tabindex="-1">
<section class="hl-hero" id="hl-home" aria-labelledby="hl-h1"><div class="hl-hero-bg" aria-hidden="true"><svg class="hl-geo" viewBox="0 0 200 200"><g fill="none" stroke="currentColor" stroke-width=".6"><circle cx="100" cy="100" r="92"/><circle cx="100" cy="100" r="64"/><rect x="36" y="36" width="128" height="128"/><rect x="36" y="36" width="128" height="128" transform="rotate(45 100 100)"/><circle cx="100" cy="100" r="30"/></g></svg></div>
<div class="hl-wrap hl-hero-in">
  <div class="hl-hero-copy">
    <p class="hl-pill">${ic('wifioff')}تعمل بلا إنترنت أيضًا</p>
    <h1 id="hl-h1">حلقتك كلها <span>في مكان واحد</span></h1>
    <p class="hl-sub">منصة عربية لإدارة حلقات تحفيظ القرآن الكريم: التسميع والخطط والحضور والتقارير ومتابعة أولياء الأمور، على الجوال والحاسوب.</p>
    <div class="hl-cta"><button class="hl-btn hl-btn-solid hl-btn-lg" type="button" data-hl-login>ابدأ الآن${ic('arrow')}</button><a class="hl-btn hl-btn-ghost hl-btn-lg" href="#hl-demo">استكشف المنصة</a></div>
  </div>
  <div class="hl-stage" aria-hidden="true">
    <div class="hl-desk"><div class="hl-desk-bar"><i></i><i></i><i></i></div><div class="hl-desk-body"><aside><i class="on"></i><i></i><i></i><i></i></aside><div class="hl-desk-main"><div class="hl-kpis"><i></i><i></i><i></i></div><div class="hl-bars hl-bars-lg"><i style="--h:35%"></i><i style="--h:55%"></i><i style="--h:48%"></i><i style="--h:72%"></i><i style="--h:60%"></i><i style="--h:88%"></i><i style="--h:78%"></i></div></div></div></div>
    <div class="hl-phone"><div class="hl-phone-top"><b>جلسة التسميع</b><small>بيانات توضيحية</small></div>
      <div class="hl-prow"><span class="hl-av"></span><div><b>طالب تجريبي</b><small>2 صفحات</small></div><em class="ok">ممتاز</em></div>
      <div class="hl-prow"><span class="hl-av"></span><div><b>طالبة تجريبية</b><small>1 صفحة</small></div><em class="gd">جيد جدًا</em></div>
      <div class="hl-prow live"><span class="hl-av"></span><div><b>طالب تجريبي</b><small>جارٍ التسميع</small></div><em class="mic">${ic('mic')}</em></div>
    </div>
  </div>
</div></section>

<section class="hl-sec hl-about" id="hl-about" aria-labelledby="hl-about-h"><div class="hl-wrap hl-split">
  <div><h2 id="hl-about-h">لماذا حلقاتي؟</h2><p class="hl-lead">صُمّمت لتبسّط عمل الحلقة اليومي، لا لتزيد أوراقه.</p></div>
  <ul class="hl-points">
    <li>${ic('mic')}<div><h3>تسميع أسرع</h3><p>سجّل التقييم والملاحظات أثناء الجلسة بدل تدوينها لاحقًا.</p></div></li>
    <li>${ic('wifioff')}<div><h3>لا يتوقف عند انقطاع الشبكة</h3><p>تُحفظ البيانات محليًا وتُزامَن عند عودة الاتصال.</p></div></li>
    <li>${ic('shield')}<div><h3>لكل دور ما يخصّه</h3><p>محفّظ ومشرف وولي أمر ومسؤول ومانح، كلٌّ بصلاحياته.</p></div></li>
  </ul>
</div></section>

<section class="hl-sec" id="hl-features" aria-labelledby="hl-feat-h"><div class="hl-wrap">
  <div class="hl-head"><h2 id="hl-feat-h">كل ما تحتاجه الحلقة</h2><p class="hl-lead">اثنا عشر مجالًا يعمل بعضها مع بعض.</p></div>
  <div class="hl-bento">${FEATURES.map(feature).join('')}</div>
</div></section>

<section class="hl-sec hl-alt" id="hl-roles" aria-labelledby="hl-roles-h"><div class="hl-wrap">
  <div class="hl-head"><h2 id="hl-roles-h">اختر دورك وشاهد ما يناسبك</h2><p class="hl-lead">تعرض المنصة لكل مستخدم صفحاته وإجراءاته.</p></div>
  <div class="hl-roles"><div class="hl-tabs" role="tablist" aria-label="الأدوار" id="hl-rtabs">${ROLES.map(roleTab).join('')}</div><div class="hl-panels" id="hl-rpanels">${ROLES.map(rolePanel).join('')}</div></div>
</div></section>

<section class="hl-sec" id="hl-demo" aria-labelledby="hl-demo-h"><div class="hl-wrap">
  <div class="hl-head"><h2 id="hl-demo-h">جرّب بنفسك دون تسجيل</h2><p class="hl-lead">بيانات تجريبية معزولة لا تُحفظ ولا تُرسل إلى أي مكان.</p></div>
  <div class="hl-demo" id="hl-demoapp">
    <div class="hl-tabs hl-dtabs" role="tablist" aria-label="أجزاء التجربة">
      <button class="hl-tab" role="tab" id="hl-dt-rec" aria-controls="hl-dp-rec" aria-selected="true" type="button">${ic('mic')}<span>تسجيل تسميع</span></button>
      <button class="hl-tab" role="tab" id="hl-dt-mus" aria-controls="hl-dp-mus" aria-selected="false" tabindex="-1" type="button">${ic('book')}<span>مصحف مصغّر</span></button>
      <button class="hl-tab" role="tab" id="hl-dt-rep" aria-controls="hl-dp-rep" aria-selected="false" tabindex="-1" type="button">${ic('chart')}<span>لوحة التقارير</span></button>
    </div>
    <div class="hl-dpanel" role="tabpanel" id="hl-dp-rec" aria-labelledby="hl-dt-rec" tabindex="0">
      <form class="hl-form" id="hl-recform" novalidate>
        <label>الطالب<select id="hl-d-student"></select></label>
        <label>عدد الصفحات<select id="hl-d-pages"><option value="0.5">نصف صفحة</option><option value="1" selected>صفحة</option><option value="1.5">صفحة ونصف</option><option value="2">صفحتان</option></select></label>
        <label>عدد الأخطاء<input id="hl-d-mist" type="number" min="0" max="20" value="1" inputmode="numeric"></label>
        <button class="hl-btn hl-btn-solid" type="submit">سجّل التسميع</button>
      </form>
      <div class="hl-result" id="hl-d-result" role="status" aria-live="polite">اختر الطالب وسجّل تسميعًا تجريبيًا لترى النتيجة.</div>
      <div class="hl-stud" id="hl-d-list"></div>
    </div>
    <div class="hl-dpanel" role="tabpanel" id="hl-dp-mus" aria-labelledby="hl-dt-mus" tabindex="0" hidden>
      <div class="hl-mus"><div class="hl-mus-page" id="hl-mus-page" aria-label="صفحة مصحف توضيحية بلا نص"></div>
        <div class="hl-mus-side"><p>هيكل صفحة المصحف بخمسة عشر سطرًا. حدّد المحفوظ لترى كيف تُعلَّم الصفحة.</p>
          <div class="hl-mus-nav"><button class="hl-btn hl-btn-ghost" id="hl-mus-prev" type="button">الصفحة السابقة</button><output id="hl-mus-num">صفحة 41</output><button class="hl-btn hl-btn-ghost" id="hl-mus-next" type="button">الصفحة التالية</button></div>
          <label>المحفوظ من الصفحة<input id="hl-mus-range" type="range" min="0" max="15" value="9" aria-describedby="hl-mus-info"></label><p id="hl-mus-info" class="hl-note"></p></div></div>
    </div>
    <div class="hl-dpanel" role="tabpanel" id="hl-dp-rep" aria-labelledby="hl-dt-rep" tabindex="0" hidden>
      <div class="hl-rep"><div class="hl-rep-kpis" id="hl-rep-kpis"></div><div class="hl-rep-chart" id="hl-rep-chart" role="img" aria-label="رسم توضيحي لعدد الصفحات المسمَّعة خلال الأسبوع"></div><p class="hl-note">الأرقام أعلاه تتغيّر مع تسجيلك في تبويب التسميع.</p></div>
    </div>
  </div>
</div></section>

<section class="hl-sec hl-alt" id="hl-how" aria-labelledby="hl-how-h"><div class="hl-wrap">
  <div class="hl-head"><h2 id="hl-how-h">كيف تبدأ؟</h2><p class="hl-lead">من الحساب الأول إلى المتابعة اليومية في خمس خطوات.</p></div>
  <ol class="hl-steps" id="hl-steps">${STEPS.map(step).join('')}</ol>
</div></section>

<section class="hl-sec" id="hl-showcase" aria-labelledby="hl-show-h"><div class="hl-wrap">
  <div class="hl-head"><h2 id="hl-show-h">لمحة عن الواجهة</h2><p class="hl-lead">تمرّر الصفحة فتتبدّل الشاشة. نماذج توضيحية مبسّطة.</p></div>
  <div class="hl-show" id="hl-showwrap"><ol class="hl-show-steps">
    <li data-scr="0" class="on"><h3>الرئيسية</h3><p>ما يستحق الانتباه اليوم في بطاقات واضحة.</p></li>
    <li data-scr="1"><h3>الجلسة</h3><p>قائمة الطلاب وتقييم كل تسميعة.</p></li>
    <li data-scr="2"><h3>التقارير</h3><p>صورة أسبوعية لتقدّم الحلقة.</p></li></ol>
    <div class="hl-show-dev" aria-hidden="true"><div class="hl-phone hl-phone-lg"><div class="hl-scr on" data-scr="0"><div class="hl-phone-top"><b>الرئيسية</b></div><div class="hl-tilebox"><i></i><i></i></div><div class="hl-prow"><span class="hl-av"></span><div><b>جلسة اليوم</b><small>مفتوحة</small></div></div><div class="hl-prow"><span class="hl-av"></span><div><b>خطة تحتاج متابعة</b><small>تأخر يومان</small></div></div></div>
      <div class="hl-scr" data-scr="1"><div class="hl-phone-top"><b>الجلسة</b></div><div class="hl-prow"><span class="hl-av"></span><div><b>طالب تجريبي</b></div><em class="ok">ممتاز</em></div><div class="hl-prow"><span class="hl-av"></span><div><b>طالبة تجريبية</b></div><em class="gd">جيد جدًا</em></div><div class="hl-prow"><span class="hl-av"></span><div><b>طالب تجريبي</b></div><em class="ok">ممتاز</em></div></div>
      <div class="hl-scr" data-scr="2"><div class="hl-phone-top"><b>التقارير</b></div><div class="hl-bars hl-bars-lg"><i style="--h:40%"></i><i style="--h:62%"></i><i style="--h:50%"></i><i style="--h:84%"></i><i style="--h:70%"></i></div></div></div></div></div>
</div></section>

<section class="hl-sec hl-android" id="hl-app" aria-labelledby="hl-app-h"><div class="hl-wrap hl-split">
  <div><h2 id="hl-app-h">تطبيق حلقاتي لأندرويد</h2><p class="hl-lead">ثبّت التطبيق على جهازك واستخدمه بلا إنترنت.${version ? ` الإصدار الحالي ${version}.` : ''}</p>
    <div class="hl-cta"><a class="hl-btn hl-btn-solid hl-btn-lg" href="./Halaqati-latest.apk" download>${ic('download')}تحميل ملف APK</a></div>
    <p class="hl-note">عند التثبيت قد يطلب أندرويد السماح بالتثبيت من هذا المصدر. يمكنك أيضًا تثبيت المنصة من المتصفح كتطبيق ويب.</p></div>
  <div class="hl-apk" aria-hidden="true">${ic('phone')}</div>
</div></section>

<section class="hl-sec hl-alt" id="hl-faq" aria-labelledby="hl-faq-h"><div class="hl-wrap hl-narrow">
  <div class="hl-head"><h2 id="hl-faq-h">الأسئلة الشائعة</h2></div>
  <div class="hl-faqs">${FAQ.map(faq).join('')}</div>
</div></section>

<section class="hl-sec hl-final" id="hl-cta" aria-labelledby="hl-cta-h"><div class="hl-wrap">
  <h2 id="hl-cta-h">ابدأ بتنظيم حلقتك اليوم</h2><p class="hl-lead">أنشئ حسابك وسيعتمده مسؤول النظام.</p>
  <div class="hl-cta hl-center"><button class="hl-btn hl-btn-solid hl-btn-lg" type="button" data-hl-login>تسجيل الدخول</button><a class="hl-btn hl-btn-ghost hl-btn-lg" href="./Halaqati-latest.apk" download>تحميل التطبيق</a></div>
</div></section>
</main>

<footer class="hl-foot"><div class="hl-wrap hl-foot-in">
  <div class="hl-brand"><img src="./brand/logo.svg" width="32" height="32" alt="" loading="lazy"><span>حلقاتي</span></div>
  <nav aria-label="روابط التذييل"><a href="#hl-features">المميزات</a><a href="#hl-how">كيفية الاستخدام</a><a href="#hl-faq">الأسئلة الشائعة</a><a href="./Halaqati-latest.apk" download>تحميل التطبيق</a><button type="button" class="hl-linkbtn" data-hl-login>تسجيل الدخول</button></nav>
  <p class="hl-note">حلقاتي، إدارة ومتابعة حلقات تحفيظ القرآن الكريم.${version ? ' الإصدار ' + version : ''}</p>
</div></footer>`;
}
