// Presentation for «متابعة المحفظين»: markup only. Data, permissions and actions stay in rc53/runtime.js.
import { icon } from "./dashboard.mjs";

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
