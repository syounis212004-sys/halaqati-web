// Presentation for «متابعة المحفظين»: markup only. Data, permissions and actions stay in rc53/runtime.js.
import { icon, medallion } from "./dashboard.mjs";

const arg = (value, e) => e(JSON.stringify(String(value ?? "")));
const TODAY = {
  none: ["لم يبدأ جلسة اليوم", "none"],
  open: ["جلسته جارية", "open"],
  closed: ["أنهى جلسة اليوم", "closed"],
};

export function stat(value, label, tone, e) {
  return `<div class="sv-kpi" data-tone="${tone || ""}"><strong><bdi dir="ltr">${e(value)}</bdi></strong><span>${e(label)}</span></div>`;
}

export function avatar(photo, name, e) {
  const first = (name || "؟").trim()[0] || "؟";
  return photo && String(photo).startsWith("data:image/")
    ? `<img class="sv-person-av" alt="" src="${photo}">`
    : `<span class="sv-person-av" aria-hidden="true">${e(first)}</span>`;
}

function fact(label, value, e) {
  return `<div><dt>${e(label)}</dt><dd><bdi>${e(value)}</bdi></dd></div>`;
}

export function teacherCard(r, ctx) {
  const { e, open, num1 } = ctx;
  const idle = !r.halaqat.length;
  const today = TODAY[r.today];
  const status = idle
    ? ["بلا حلقة", "idle"]
    : r.pct == null
      ? ["لا بيانات بعد", "idle"]
      : r.pct >= 80
        ? ["ملتزم", "ok"]
        : r.pct >= 50
          ? ["يحتاج تحسينًا", "warn"]
          : ["يحتاج متابعة", "bad"];
  const bar =
    r.pct == null
      ? ""
      : `<div class="sv-progress" role="progressbar" aria-label="التزام ${e(r.name)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${r.pct}"><span style="width:${r.pct}%"></span></div>`;
  const first = r.halaqat[0];
  const alert = `RC50.s3.alert(${arg(r.id, e)},${arg(r.name, e)},${arg(first?.id || "", e)},"")`;
  const details = open
    ? `<div class="sv-person-more" id="svp-${e(r.id)}">
        <dl class="sv-facts">${fact("جلسات الشهر", r.sessions, e)}${fact("أيام النشاط", `${r.days} من ${r.monthDays}`, e)}${fact("جلسات مُنهاة", r.closed, e)}${fact("جلسات لم تُنهَ بعد", Math.max(0, r.sessions - r.closed), e)}${fact("التسميعات هذا الشهر", r.rec == null ? "—" : r.rec, e)}</dl>
        <p>آخر جلسة: <bdi>${e(r.last)}</bdi></p>
        <p>زيارات المشرف هذا الشهر: <bdi>${e(r.visits)}</bdi>${r.score != null ? ` · متوسط التقييم <bdi>${e(num1(r.score))}/5</bdi>` : ""}</p>
        ${r.openActions ? `<p class="sv-warn-text">إجراءات مطلوبة لم تُنفَّذ: <bdi>${e(r.openActions)}</bdi></p>` : ""}
        ${r.phone ? `<p>الهاتف: <bdi dir="ltr">${e(r.phone)}</bdi></p>` : ""}
      </div>`
    : "";
  return `<article class="sv-person" data-tone="${status[1]}">
    <button type="button" class="sv-person-head" aria-expanded="${open ? "true" : "false"}" ${open ? `aria-controls="svp-${e(r.id)}"` : ""} onclick="RC50.s3.toggle(${arg(r.id, e)})">
      ${avatar(r.photo, r.name, e)}
      <span class="sv-person-id"><strong>${e(r.name)}</strong><small>${e(r.halaqat.map((h) => h.name).join("، ") || "لم تُسنَد إليه حلقة بعد")}</small></span>
      <span class="sv-chev ${open ? "open" : ""}">${icon("arrow", 18)}</span>
    </button>
    <div class="sv-person-state"><span class="sv-pill" data-tone="${status[1]}">${e(status[0])}${r.pct == null ? "" : ` <bdi dir="ltr">${e(r.pct)}%</bdi>`}</span>${idle ? "" : `<span class="sv-pill" data-today="${today[1]}">${e(today[0])}</span>`}</div>
    ${bar}
    ${idle ? "" : `<p class="sv-person-line">نشِط <bdi>${e(r.days)}</bdi> يومًا من <bdi>${e(r.monthDays)}</bdi> هذا الشهر · <bdi>${e(r.sessions)}</bdi> جلسة</p>`}
    ${details}
    <div class="sv-person-actions">
      <button type="button" class="sv-button sv-button-tonal" onclick='${alert}'>${icon("notifications", 18)}إرسال تنبيه</button>
      ${first ? `<button type="button" class="sv-button sv-button-primary" onclick="RC50.s3.visitNew(${arg(first.id, e)})">${icon("visits", 18)}تسجيل زيارة</button>` : ""}
    </div>
  </article>`;
}

export function supervisorCard(r, ctx) {
  const { e, open } = ctx;
  const tone = r.pct == null ? "idle" : r.pct >= 80 ? "ok" : r.pct >= 50 ? "warn" : "bad";
  const label = r.pct == null ? "لا حلقات" : r.pct >= 80 ? "ممتاز" : r.pct >= 50 ? "جيد" : "يحتاج متابعة";
  return `<article class="sv-person" data-tone="${tone}">
    <button type="button" class="sv-person-head" aria-expanded="${open ? "true" : "false"}" onclick="RC50.s3.toggle(${arg(r.id, e)})">${avatar(r.photo, r.name, e)}<span class="sv-person-id"><strong>${e(r.name)}</strong><small><bdi>${e(r.total)}</bdi> حلقة تحت إشرافه</small></span><span class="sv-chev ${open ? "open" : ""}">${icon("arrow", 18)}</span></button>
    <div class="sv-person-state"><span class="sv-pill" data-tone="${tone}">${e(label)}${r.pct == null ? "" : ` <bdi dir="ltr">${e(r.pct)}%</bdi>`}</span></div>
    ${open ? `<div class="sv-person-more"><p>زار <bdi>${e(r.visited)}</bdi> من <bdi>${e(r.total)}</bdi> حلقات هذا الشهر · <bdi>${e(r.made)}</bdi> زيارة</p><p>آخر زيارة: <bdi>${e(r.last)}</bdi></p></div>` : ""}
    <div class="sv-person-actions"><button type="button" class="sv-button sv-button-tonal" onclick='RC50.s3.alert(${arg(r.id, e)},${arg(r.name, e)},"","")'>${icon("notifications", 18)}إرسال تنبيه</button></div>
  </article>`;
}

export function page({ kpis, seg, body }) {
  return `<div class="sv-dashboard sv-supervision"><div class="sv-kpis">${kpis}</div>${seg}<div class="sv-people">${body}</div></div>`;
}

// ---------- البرامج (الدورات وبرامج التلاوة والتجويد) ----------
const dayNo = (iso) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / 864e5);

function timeline(p, today) {
  if (!p.starts || !p.ends) return null;
  const total = dayNo(p.ends) - dayNo(p.starts) + 1;
  if (total <= 0) return null;
  const done = Math.min(total, Math.max(0, dayNo(today) - dayNo(p.starts) + 1));
  const phase = today < p.starts ? "لم يبدأ بعد" : today > p.ends ? "انتهى" : "جارٍ";
  return { total, done, pct: Math.round((done * 100) / total), phase };
}

export function programCard(p, { e, today }) {
  const tl = timeline(p, today);
  const s = TODAY[p.state];
  const alert = `RC50.s3.alert(${arg(p.tids[0] || "", e)},${arg(p.names[0] || "", e)},${arg(p.id, e)},${arg(p.state === "none" ? "1" : "", e)})`;
  return `<article class="sv-person sv-program">
    <div class="sv-person-head sv-static">${medallion(p.logo, p.name, e)}<span class="sv-person-id"><strong>${e(p.name)}</strong><small>${e(p.names.join("، ") || "لم يُسنَد محفّظ بعد")}</small></span></div>
    <div class="sv-person-state"><span class="sv-pill">${e(p.kind)}</span>${tl ? `<span class="sv-pill" data-tone="${tl.phase === "جارٍ" ? "ok" : "warn"}">${e(tl.phase)}</span>` : ""}${s ? `<span class="sv-pill" data-today="${s[1]}">${e(s[0])}</span>` : ""}</div>
    ${tl ? `<div class="sv-progress" role="progressbar" aria-label="تقدم ${e(p.name)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${tl.pct}"><span style="width:${tl.pct}%"></span></div><p class="sv-person-line">اليوم <bdi>${e(tl.done)}</bdi> من <bdi>${e(tl.total)}</bdi> · من <bdi>${e(p.starts)}</bdi> إلى <bdi>${e(p.ends)}</bdi></p>` : ""}
    <dl class="sv-facts">${fact("المشاركون", p.students, e)}${fact("جلسات الشهر", p.monthSessions, e)}${fact("سُمّع اليوم", p.recited, e)}${fact("آخر جلسة", p.last || "—", e)}</dl>
    <div class="sv-person-actions"><button type="button" class="sv-button sv-button-tonal" ${p.tids.length ? "" : "disabled"} onclick='${alert}'>${icon("notifications", 18)}تنبيه المحفّظ</button><button type="button" class="sv-button sv-button-primary" onclick="RC50.s3.visitNew(${arg(p.id, e)})">${icon("visits", 18)}تسجيل زيارة</button></div>
  </article>`;
}

export function programsPage(programs, ctx) {
  const { e } = ctx;
  const members = programs.reduce((n, p) => n + p.students, 0);
  const month = programs.reduce((n, p) => n + p.monthSessions, 0);
  const body = programs.length
    ? programs.map((p) => programCard(p, ctx)).join("")
    : `<div class="sv-empty">لا توجد برامج مسندة إليك. تظهر هنا الدورات وبرامج التلاوة والتجويد التي تشرف عليها.</div>`;
  return `<div class="sv-dashboard sv-supervision"><div class="sv-kpis">${stat(programs.length, "البرامج", "", e)}${stat(members, "المشاركون", "", e)}${stat(month, "جلسات الشهر", "", e)}</div><div class="sv-people">${body}</div></div>`;
}

// ---------- الزيارات والجلسات والمقارنة ----------
const meter = (label, v) =>
  `<div class="sv-meter" ${v == null ? 'data-empty="1"' : ""}><span>${label}</span><div class="sv-meter-bar" role="img" aria-label="${label} ${v == null ? "غير مقيّم" : `${v} من 5`}"><i style="width:${v == null ? 0 : v * 20}%"></i></div><b><bdi>${v == null ? "—" : `${v}/5`}</bdi></b></div>`;

export function visitCard(v, { e, halaqa, logo, text }) {
  const note = text(v.notes), todo = text(v.action_items);
  const att = v.teacher_attendance == null ? "" : v.teacher_attendance ? ["المحفّظ حاضر", "ok"] : ["المحفّظ غائب", "bad"];
  return `<article class="sv-person sv-visit">
    <div class="sv-person-head sv-static">${medallion(logo, halaqa, e)}<span class="sv-person-id"><strong>${e(halaqa)}</strong><small><bdi>${e(v.visit_date)}</bdi></small></span>${v._pending ? '<span class="sv-pill" data-tone="warn">بانتظار الرفع</span>' : ""}</div>
    <div class="sv-meters">${meter("التنظيم", v.organization_score)}${meter("التدريس", v.teaching_score)}${meter("المتابعة", v.followup_score)}</div>
    ${att ? `<div class="sv-person-state"><span class="sv-pill" data-tone="${att[1]}">${att[0]}</span></div>` : ""}
    ${note ? `<p class="sv-note">${e(note)}</p>` : ""}
    ${todo ? `<div class="sv-todo" data-done="${v.action_done ? "1" : "0"}">${icon(v.action_done ? "check" : "alert", 18)}<span><b>المطلوب من المحفّظ</b>${e(todo)}</span></div>` : ""}
    <div class="sv-person-actions sv-actions-3"><button type="button" class="sv-button sv-button-tonal" onclick="RC50.s3.visitEdit(${arg(v.id, e)})">${icon("edit", 17)}تعديل</button>${todo && !v.action_done ? `<button type="button" class="sv-button sv-button-primary" onclick="RC50.s3.visitDone(${arg(v.id, e)})">${icon("check", 17)}تم التنفيذ</button>` : ""}<button type="button" class="sv-button sv-button-danger" onclick="RC50.s3.visitDel(${arg(v.id, e)})">${icon("trash", 17)}حذف</button></div>
  </article>`;
}

export function visitsPage(cards, add, empty) {
  return `<div class="sv-dashboard sv-supervision"><button type="button" class="sv-button sv-button-primary sv-wide" onclick="${add}">${icon("visits", 19)}تسجيل زيارة جديدة</button><div class="sv-people">${cards || `<div class="sv-empty">${empty}</div>`}</div></div>`;
}

export function sessionCard(s, { e, halaqa, logo, teacher, present, absent, recited }) {
  const closed = s.status === "closed";
  return `<article class="sv-person sv-session">
    <div class="sv-person-head sv-static">${medallion(logo, halaqa, e)}<span class="sv-person-id"><strong>${e(halaqa)}</strong><small>${e(teacher)} · <bdi>${e(s.session_date)}</bdi></small></span><span class="sv-pill" data-tone="${closed ? "ok" : "warn"}">${closed ? "مُنهاة" : "جارية"}</span></div>
    <dl class="sv-facts sv-facts-3">${fact("حضور", present, e)}${fact("غياب", absent, e)}${fact("سُمّع", recited, e)}</dl>
  </article>`;
}

export function sessionsPage(cards, empty) {
  return `<div class="sv-dashboard sv-supervision"><p class="sv-hint">عرض للمتابعة فقط · آخر 10 أيام</p><div class="sv-people">${cards || `<div class="sv-empty">${empty}</div>`}</div></div>`;
}

export function rankRow(i, name, label, pct, e) {
  const medal = ["gold", "silver", "bronze"][i] || "";
  return `<div class="sv-rank ${medal}"><span class="sv-rank-n">${i + 1}</span><div class="sv-rank-body"><div class="sv-rank-top"><strong>${e(name)}</strong><small><bdi>${e(label)}</bdi></small></div><div class="sv-progress"><span style="width:${pct}%"></span></div></div></div>`;
}
