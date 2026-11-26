/* Halaqati web RC114: contest rules (port of Android ContestRules.kt). Pure logic, no DOM; the server enforces the same limits. */
export const STATUS_LABEL = { pending: 'بانتظار المدير', approved: 'معتمدة', rejected: 'مرفوضة' };
export const STATUSES = ['pending', 'approved', 'rejected'];
export const LIMITS = { name: [3, 80], title: [3, 120], conditions: [10, 2000], reward: [3, 500], reason: [3, 500] };
export const NO_HALAQA_MESSAGE = 'لم يُربط حسابك بأي حلقة بعد. سيحدد مدير النظام حلقتك عند مراجعة المسابقة.';

export const statusOf = (v) => { const s = String(v == null ? '' : v).trim().toLowerCase(); return STATUSES.includes(s) ? s : 'pending'; };

export const creatorLabel = (role) => ({ teacher: 'المحفظ', supervisor: 'المشرف', admin: 'مدير النظام' })[role] || 'المانح';

export const noHalaqaMessage = (role) => role === 'observer' ? NO_HALAQA_MESSAGE
  : role === 'admin' ? 'لا توجد حلقة فعّالة لإنشاء مسابقة لها.'
  : 'لا توجد حلقة مرتبطة بحسابك لإنشاء مسابقة. تواصل مع مدير النظام لربطك بحلقتك.';

const pad = (n, w = 2) => String(n).padStart(w, '0');
export const formatDate = (y, m, d) => `${pad(d)}-${pad(m)}-${pad(y, 4)}`;
export const dateError = (which) => `تاريخ ${which} غير صالح. اكتبه هكذا: 01-12-2026 (يوم-شهر-سنة)`;

/** Day-month-year or year-month-day, separators - / . , Arabic-Indic or Persian digits, invisible direction marks ignored. */
export function parseDate(raw) {
  const t = String(raw == null ? '' : raw).replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x6F0))
    .replace(/[‎-‏‪-‮⁦-⁩\s]/g, '');
  const m = /^(\d{1,4})[-/.](\d{1,2})[-/.](\d{1,4})$/.exec(t);
  if (!m) return null;
  const a = m[1], b = Number(m[2]), c = m[3];
  let y, mo, d;
  if (a.length === 4 && c.length <= 2) { y = Number(a); mo = b; d = Number(c); }
  else if (c.length === 4 && a.length <= 2) { y = Number(c); mo = b; d = Number(a); }
  else return null;
  if (y < 2000 || y > 2100 || mo < 1 || mo > 12 || d < 1) return null;
  if (d > new Date(Date.UTC(y, mo, 0)).getUTCDate()) return null;
  return { y, m: mo, d };
}

const iso = (p) => `${pad(p.y, 4)}-${pad(p.m)}-${pad(p.d)}`;
/** ISO (2026-12-01) for the database; null when empty; the text unchanged when it is not a date (validate reports it). */
export function normalizeDate(raw) {
  const t = raw == null ? '' : String(raw).trim();
  if (!t) return null;
  const p = parseDate(t);
  return p ? iso(p) : t;
}

/** Field key -> Arabic message. Empty object = valid. */
export function validate(d) {
  const e = {};
  const check = (key, label, v, [min, max]) => {
    const n = String(v == null ? '' : v).trim().length;
    if (n === 0) e[key] = `${label} مطلوب`;
    else if (n < min) e[key] = `${label} قصير جدًا (الحد الأدنى ${min} أحرف)`;
    else if (n > max) e[key] = `${label} طويل جدًا (الحد الأقصى ${max} حرفًا)`;
  };
  check('name', 'اسم المسابقة', d.name, LIMITS.name);
  check('title', 'العنوان', d.title, LIMITS.title);
  check('conditions', 'الشروط', d.conditions, LIMITS.conditions);
  check('reward', 'المكافأة', d.reward, LIMITS.reward);
  const s = String(d.startsOn || '').trim() ? parseDate(d.startsOn) : null;
  const en = String(d.endsOn || '').trim() ? parseDate(d.endsOn) : null;
  if (String(d.startsOn || '').trim() && !s) e.startsOn = dateError('البداية');
  if (String(d.endsOn || '').trim() && !en) e.endsOn = dateError('النهاية');
  if (s && en && iso(en) < iso(s)) e.endsOn = 'تاريخ النهاية قبل تاريخ البداية';
  return e;
}

export const canTransition = (from, to) => from === 'pending' && (to === 'approved' || to === 'rejected');

/** null when the decision may be sent; otherwise 'transition', 'reason' or 'halaqa'. */
export function decisionError(from, to, reason, halaqaId) {
  if (!canTransition(from, to)) return 'transition';
  const n = String(reason == null ? '' : reason).trim().length;
  if (to === 'rejected' && (n < LIMITS.reason[0] || n > LIMITS.reason[1])) return 'reason';
  if (to === 'approved' && !String(halaqaId == null ? '' : halaqaId).trim()) return 'halaqa';
  return null;
}

export const pickerState = (ids) => ids.length === 0 ? 'none' : ids.length === 1 ? 'single' : 'choose';
export const filterByStatus = (items, status) => status ? items.filter((c) => c.status === status) : items;

/** Exact argument names of contest_submit (migration 20261126). */
export const buildSubmitArgs = (d, halaqaId) => ({
  p_name: String(d.name).trim(), p_title: String(d.title).trim(), p_conditions: String(d.conditions).trim(), p_reward: String(d.reward).trim(),
  p_halaqa: halaqaId || null, p_starts_on: normalizeDate(d.startsOn), p_ends_on: normalizeDate(d.endsOn),
});
/** Exact argument names of contest_decide. Only a donor is linked to the halaqa by an approval. */
export const buildDecideArgs = (id, approve, reason, halaqaId, linkDonor) => ({
  p_id: id, p_status: approve ? 'approved' : 'rejected', p_reason: String(reason || '').trim() || null,
  p_halaqa: halaqaId || null, p_link_donor: !!(approve && linkDonor),
});
