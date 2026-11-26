/* Halaqati web RC114: local contribution reminder (port of Android reminders/*.kt).
   Pure date maths + localStorage preferences. Days are ISO weekdays (1=Monday .. 7=Sunday), like java.time.DayOfWeek.
   Web limit: nothing can fire while the browser is closed, so the UI shows the reminder when the app is opened after the time. */
export const PREFS_KEY = 'halaqati_reminder_v1';
export const ACK_KEY = 'halaqati_reminder_ack_v1';
export const DEFAULT = Object.freeze({ enabled: true, days: Object.freeze([4]), hour: 18, minute: 0 });
/** A missed reminder is still shown when the app is opened within this long after the time (Android skips after 2 h; a browser tab is opened less predictably). */
export const MAX_LATE_MS = 24 * 3600 * 1000;
/** Arabic week order, Saturday first. */
export const WEEK = [[6, 'السبت'], [7, 'الأحد'], [1, 'الاثنين'], [2, 'الثلاثاء'], [3, 'الأربعاء'], [4, 'الخميس'], [5, 'الجمعة']];

export const dayName = (d) => (WEEK.find((x) => x[0] === d) || [0, ''])[1];
const AR = '٠١٢٣٤٥٦٧٨٩';
const arDigits = (s) => String(s).replace(/\d/g, (c) => AR[Number(c)]);
/** 18:05 -> "٦:٠٥ م". */
export const timeLabel = (hour, minute) => `${arDigits(hour % 12 === 0 ? 12 : hour % 12)}:${arDigits(String(minute).padStart(2, '0'))} ${hour < 12 ? 'ص' : 'م'}`;
export const toTimeInput = (h, m) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
export function fromTimeInput(v) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(v || '').trim());
  if (!m) return null;
  const hour = Number(m[1]), minute = Number(m[2]);
  return hour > 23 || minute > 59 ? null : { hour, minute };
}

const isoDay = (date) => date.getDay() === 0 ? 7 : date.getDay();
const occurrence = (base, plusDays, r) => new Date(base.getFullYear(), base.getMonth(), base.getDate() + plusDays, r.hour, r.minute, 0, 0);
const active = (r) => r && r.enabled && Array.isArray(r.days) && r.days.length > 0;

/** The first moment after `now` that matches the reminder, or null when it is off or has no day chosen. */
export function nextAt(now, r) {
  if (!active(r)) return null;
  for (let i = 0; i <= 7; i++) {
    const at = occurrence(now, i, r);
    if (r.days.includes(isoDay(at)) && at.getTime() > now.getTime()) return at;
  }
  return null;
}

/** The latest occurrence at or before `now` (looking back one week), or null. */
export function lastDueAt(now, r) {
  if (!active(r)) return null;
  for (let i = 0; i <= 7; i++) {
    const at = occurrence(now, -i, r);
    if (r.days.includes(isoDay(at)) && at.getTime() <= now.getTime()) return at;
  }
  return null;
}

/** The occurrence to announce now: not yet acknowledged and not older than `maxLateMs`; otherwise null. */
export function dueOccurrence(now, r, ackMs, maxLateMs = MAX_LATE_MS) {
  const at = lastDueAt(now, r);
  if (!at) return null;
  if (at.getTime() <= (Number(ackMs) || 0)) return null;
  return now.getTime() - at.getTime() <= maxLateMs ? at : null;
}

/** Fixed texts per role, kept in the app (they never come from the server). */
export function textForRole(role) {
  const r = String(role || '').toLowerCase();
  if (r === 'guardian') return { title: 'تكفّل بحلقة أبنائك', body: 'ساهم بكفالة أو دعم لحلقة أبنائك. افتح صفحة المساهمة.' };
  if (r === 'teacher' || r === 'supervisor' || r === 'admin') return { title: 'أنشئ مسابقة لحلقتك', body: 'حفّز طلابك بمسابقة جديدة. افتح صفحة المساهمة.' };
  return null;
}

const clamp = (n, lo, hi, fb) => { const v = Math.trunc(Number(n)); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fb; };
export function loadPrefs(storage) {
  try {
    const raw = storage && storage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULT, days: [...DEFAULT.days] };
    const o = JSON.parse(raw);
    const days = [...new Set((Array.isArray(o.days) ? o.days : []).map(Number).filter((d) => Number.isInteger(d) && d >= 1 && d <= 7))];
    return { enabled: o.enabled !== false, days, hour: clamp(o.hour, 0, 23, 18), minute: clamp(o.minute, 0, 59, 0) };
  } catch (_e) { return { ...DEFAULT, days: [...DEFAULT.days] }; }
}
export function savePrefs(storage, r) {
  try { storage.setItem(PREFS_KEY, JSON.stringify({ enabled: !!r.enabled, days: r.days, hour: r.hour, minute: r.minute })); } catch (_e) { /* storage blocked: the page still works for this visit */ }
}
export function loadAck(storage) { try { return Number(storage.getItem(ACK_KEY)) || 0; } catch (_e) { return 0; } }
export function saveAck(storage, ms) { try { storage.setItem(ACK_KEY, String(ms)); } catch (_e) { /* ignore */ } }
