// Supervisor presentation only: queries, permissions and actions remain in the existing runtimes.
const paths = {
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
  halaqas:
    '<rect x="3" y="4" width="7" height="7" rx="2"/><rect x="14" y="4" width="7" height="7" rx="2"/><rect x="3" y="15" width="7" height="7" rx="2"/><rect x="14" y="15" width="7" height="7" rx="2"/>',
  supervision:
    '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  visits:
    '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-13 5 3 3 5-5"/>',
  notifications:
    '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-9 12h6"/>',
  students:
    '<circle cx="9" cy="7" r="4"/><path d="M2 21v-2a7 7 0 0 1 14 0v2m1-17a4 4 0 0 1 0 8m3 9v-2a6 6 0 0 0-3-5"/>',
  sessions: '<path d="M5 3h14v18H5zM9 8h6m-6 4h6m-6 4h3"/>',
  reports: '<path d="M4 3v18h17M8 16v-4m5 4V8m5 8V5"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  alert: '<path d="m12 3 10 18H2L12 3Zm0 6v5m0 3v.1"/>',
  arrow: '<path d="m14 6-6 6 6 6"/>',
  settings:
    '<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="10" cy="18" r="2"/>',
  community:
    '<path d="M21 11a9 9 0 0 1-9 9H3l2-5a9 9 0 1 1 16-4Z"/><path d="M8 9h8m-8 4h5"/>',
  org: '<rect x="8" y="2" width="8" height="6" rx="1"/><path d="M12 8v5H5v3m7-3h7v3"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="16" y="16" width="6" height="6" rx="1"/>',
  exams: '<path d="M9 4H5v17h14V4h-4M9 2h6v5H9zM8 12h8m-8 4h5"/>',
  approvals: '<path d="m5 12 4 4L20 5M4 4h8M4 20h16"/>',
  ranking: '<path d="M4 21v-8h5v8m1 0V5h5v16m1 0V10h5v11"/>',
};
paths.edit = '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>';
paths.check = '<circle cx="12" cy="12" r="9"/><path d="m8 12.5 3 3 5-6"/>';
paths.trash = '<path d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3"/>';
paths.user = '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>';
paths.star = '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3Z"/>';
paths.book = '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5Zm0 14a2 2 0 0 1 2-2h13"/>';
paths.insights = paths.reports;
paths.staff = paths.students;

export function icon(name, size = 22) {
  return `<svg class="sv-icon" data-sv-icon="${name}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name] || paths.halaqas}</svg>`;
}

export function medallion(logo, name, e, size = 22) {
  return typeof logo === "string" && logo.startsWith("data:image/")
    ? `<img class="sv-logo" alt="" src="${e(logo)}">`
    : `<span class="sv-circle-icon">${icon("halaqas", size)}</span>`;
}

export function welcome({ greeting, name, avatar, quote, source }, e) {
  return `<section class="s3-welcome sv-welcome" data-rc85="1">
    <div class="sv-profile"><span class="sv-avatar" data-supervisor-avatar aria-hidden="true">${avatar}</span><div class="sv-identity"><span class="sv-greeting">${e(greeting)}</span><strong>${e(name || "أهلًا بك")}</strong><span class="sv-role">مشرف الحلقات</span></div></div>
    <blockquote class="sv-quote"><p>${e(quote)}</p><cite>${e(source)}</cite></blockquote>
  </section>`;
}

const argument = (value, e) => e(JSON.stringify(String(value ?? "")));
const alertAction = (h, e) =>
  `RC50.s3.alert(${argument(h.tids.join(","), e)},${argument(h.names.join("، "), e)},${argument(h.id, e)},${argument(h.state === "none" ? "1" : "", e)})`;

export function halaqaCard(
  h,
  { detailed, daysSince, formatNumber, escape: e, labels },
) {
  const percentage =
    h.students > 0
      ? Math.min(100, Math.round((h.recited * 100) / h.students))
      : 0;
  const teacher = h.names.join("، ") || "لم يُسنَد محفّظ بعد";
  return `<article class="s3-card sv-circle" data-state="${e(h.state)}">
    <div class="sv-circle-head">${medallion(h.logo, h.name, e)}<div><h3>${e(h.name)}</h3><p>${e(teacher)}</p></div></div>
    <div class="sv-circle-status"><span class="sv-status" data-state="${e(h.state)}"><i></i>${e(labels[h.state])}</span><span>سُمّع <bdi>${e(h.recited)} من ${e(h.students)}</bdi></span></div>
    <div class="sv-progress" role="progressbar" aria-label="تسميع طلاب ${e(h.name)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percentage}"><span style="width:${percentage}%"></span></div>
    <dl class="sv-attendance"><div><dt>الحضور</dt><dd>${e(h.present)}</dd></div><div><dt>الغياب</dt><dd>${e(h.absent)}</dd></div><div><dt>بعذر</dt><dd>${e(h.excused || 0)}</dd></div></dl>
    ${detailed ? `<p class="sv-circle-note">جلسات الشهر: ${e(h.monthSessions)} · ${h.lastVisit ? `آخر زيارة منذ ${e(daysSince(h.lastVisit))} يومًا${h.lastScore != null ? ` (${e(formatNumber(h.lastScore))}/5)` : ""}` : "لم تُسجّل زيارة بعد"}</p>` : ""}
    <div class="sv-circle-actions"><button type="button" class="sv-button sv-button-primary" onclick="RC50.s3.visitNew(${argument(h.id, e)})">${icon("visits", 19)}تسجيل زيارة</button><button type="button" class="sv-button sv-button-tonal" ${h.tids.length ? "" : "disabled"} onclick="${alertAction(h, e)}">${icon("notifications", 19)}تنبيه المحفّظ</button></div>
  </article>`;
}

export function dashboard(
  {
    programs = [],
    halaqas,
    pending,
    stale,
    started,
    weekVisits,
    openActions,
    welcome: welcomeHtml,
  },
  { escape: e, renderCircle },
) {
  const metric = (route, value, label, hint) =>
    `<button type="button" class="sv-stat" onclick="go('${route}')"><span class="sv-stat-icon">${icon(route)}</span><strong><bdi dir="ltr">${e(value)}</bdi></strong><span>${label}</span><small>${hint}</small></button>`;
  const attention = [
    ...new Map(
      [...pending.slice(0, 5), ...stale.slice(0, 3)].map((h) => [h.id, h]),
    ).values(),
  ];
  const attentionRows = attention
    .map((h) => {
      const waiting = pending.some((item) => item.id === h.id),
        overdue = stale.some((item) => item.id === h.id);
      return `<li><div><strong>${e(h.name)}</strong><p>${waiting ? "لم تبدأ جلسة اليوم" : "حان موعد زيارة المتابعة"}${overdue ? ` · ${h.lastVisit ? "الزيارة متأخرة" : "لم تُسجّل زيارة بعد"}` : ""}</p></div><button type="button" class="sv-button sv-attention-action" ${waiting && !h.tids.length ? "disabled" : ""} onclick="${waiting ? alertAction(h, e) : `RC50.s3.visitNew(${argument(h.id, e)})`}">${waiting ? "تنبيه" : "زيارة"}${icon("arrow", 16)}</button></li>`;
    })
    .join("");
  return `<div class="sv-dashboard">${welcomeHtml}
    <div class="sv-section-heading sv-day-heading"><div><h2>متابعة حلقاتك</h2></div><span class="sv-day-summary"><bdi>${e(started)} / ${e(halaqas.length)}</bdi> بدأت</span></div>
    <div class="sv-stats">${metric("halaqas", `${started}/${halaqas.length}`, "بدأت جلساتها", !halaqas.length ? "بانتظار إسناد حلقة" : pending.length ? `${e(pending.length)} بانتظار البدء` : "الجميع على الموعد")}${metric("visits", weekVisits, "زيارات الأسبوع", "خلال آخر 7 أيام")}${metric("supervision", openActions, "إجراءات للمتابعة", "من زياراتك السابقة")}</div>
    ${attention.length ? `<section class="sv-attention" aria-labelledby="svAttentionTitle"><header><span>${icon("alert")}</span><div><h2 id="svAttentionTitle">تحتاج متابعتك</h2><p>خطوة بسيطة تُحدث فرقًا اليوم</p></div><span class="sv-count">${attention.length}</span></header><ul>${attentionRows}</ul></section>` : `<section class="sv-all-clear">${icon("approvals")}<div><strong>${halaqas.length ? "أمور حلقاتك على ما يرام" : "أهلًا بك في لوحة المتابعة"}</strong><p>${halaqas.length ? "لا توجد تنبيهات متابعة حاليًا." : "ستظهر حلقاتك هنا بعد إسنادها إليك."}</p></div></section>`}
    <section class="sv-circles"><div class="sv-section-heading"><div><h2>حلقات اليوم <span class="sv-count">${halaqas.length}</span></h2></div><button type="button" class="sv-text-button" onclick="go('halaqas')">عرض الكل ${icon("arrow", 16)}</button></div><div class="sv-circle-grid">${halaqas.map(renderCircle).join("") || '<div class="sv-empty">لا توجد حلقات مسندة إليك بعد.</div>'}</div></section>
    ${programs.length ? `<section class="sv-circles"><div class="sv-section-heading"><div><h2>البرامج <span class="sv-count">${programs.length}</span></h2></div><button type="button" class="sv-text-button" onclick="go('programs')">عرض الكل ${icon("arrow", 16)}</button></div><div class="sv-circle-grid">${programs.map((p) => `<article class="s3-card sv-circle"><div class="sv-circle-head">${medallion(p.logo, p.name, e)}<div><h3>${e(p.name)}</h3><p>${e(p.kind)} · ${e(p.names.join("، ") || "بلا محفّظ")}</p></div></div><div class="sv-circle-status"><span>مشاركون <bdi>${e(p.students)}</bdi></span><span>جلسات الشهر <bdi>${e(p.monthSessions)}</bdi></span></div></article>`).join("")}</div></section>` : ""}
  </div>`;
}
