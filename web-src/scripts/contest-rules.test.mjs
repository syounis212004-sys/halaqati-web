// Mirrors ContestRules.kt (Android 2.91.14). Pure logic: no DOM.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/features/contests/rules.mjs';

const ok = { name: 'مسابقة رمضان', title: 'عنوان المسابقة', conditions: 'شروط المسابقة كاملة هنا', reward: 'جائزة قيمة' };

test('creatorLabel names who made the contest', () => {
  assert.equal(R.creatorLabel('teacher'), 'المحفظ');
  assert.equal(R.creatorLabel('supervisor'), 'المشرف');
  assert.equal(R.creatorLabel('admin'), 'مدير النظام');
  assert.equal(R.creatorLabel('donor'), 'المانح');
  assert.equal(R.creatorLabel(undefined), 'المانح');
});

test('statusOf falls back to pending and labels match Android', () => {
  assert.equal(R.statusOf('APPROVED'), 'approved');
  assert.equal(R.statusOf(' rejected '), 'rejected');
  assert.equal(R.statusOf('weird'), 'pending');
  assert.equal(R.STATUS_LABEL.pending, 'بانتظار المدير');
  assert.equal(R.STATUS_LABEL.approved, 'معتمدة');
  assert.equal(R.STATUS_LABEL.rejected, 'مرفوضة');
});

test('parseDate accepts day-first and year-first with - / . separators', () => {
  assert.deepEqual(R.parseDate('01-12-2026'), { y: 2026, m: 12, d: 1 });
  assert.deepEqual(R.parseDate('1/12/2026'), { y: 2026, m: 12, d: 1 });
  assert.deepEqual(R.parseDate('2026-12-01'), { y: 2026, m: 12, d: 1 });
  assert.deepEqual(R.parseDate('01.12.2026'), { y: 2026, m: 12, d: 1 });
});

test('parseDate reads Arabic-Indic and Persian digits and ignores direction marks', () => {
  assert.deepEqual(R.parseDate('٠١-١٢-٢٠٢٦'), { y: 2026, m: 12, d: 1 });
  assert.deepEqual(R.parseDate('۰۱-۱۲-۲۰۲۶'), { y: 2026, m: 12, d: 1 });
  assert.deepEqual(R.parseDate('‏01-12-2026‎ '), { y: 2026, m: 12, d: 1 });
  assert.deepEqual(R.parseDate('‪2026-12-01‬'), { y: 2026, m: 12, d: 1 });
});

test('parseDate rejects impossible dates, bad years and loose shapes', () => {
  assert.equal(R.parseDate('31-02-2026'), null);
  assert.equal(R.parseDate('01-13-2026'), null);
  assert.equal(R.parseDate('01-12-1999'), null);
  assert.equal(R.parseDate('01-12-2101'), null);
  assert.equal(R.parseDate('01-12-26'), null);
  assert.equal(R.parseDate('غدا'), null);
  assert.equal(R.parseDate(''), null);
  assert.deepEqual(R.parseDate('29-02-2028'), { y: 2028, m: 2, d: 29 });
  assert.equal(R.parseDate('29-02-2027'), null);
});

test('formatDate is day-first, normalizeDate gives ISO or keeps unknown text', () => {
  assert.equal(R.formatDate(2026, 12, 1), '01-12-2026');
  assert.equal(R.normalizeDate('01-12-2026'), '2026-12-01');
  assert.equal(R.normalizeDate('٠١/١٢/٢٠٢٦'), '2026-12-01');
  assert.equal(R.normalizeDate('  '), null);
  assert.equal(R.normalizeDate(null), null);
  assert.equal(R.normalizeDate('not a date'), 'not a date');
});

test('validate passes a good draft and reports field keys', () => {
  assert.deepEqual(R.validate(ok), {});
  const e = R.validate({ name: '', title: 'ab', conditions: 'قصير', reward: 'x'.repeat(501) });
  assert.equal(e.name, 'اسم المسابقة مطلوب');
  assert.equal(e.title, 'العنوان قصير جدًا (الحد الأدنى 3 أحرف)');
  assert.equal(e.conditions, 'الشروط قصير جدًا (الحد الأدنى 10 أحرف)');
  assert.equal(e.reward, 'المكافأة طويل جدًا (الحد الأقصى 500 حرفًا)');
});

test('validate limits match the server limits', () => {
  assert.deepEqual(R.LIMITS, { name: [3, 80], title: [3, 120], conditions: [10, 2000], reward: [3, 500], reason: [3, 500] });
  assert.ok(R.validate({ ...ok, name: 'a'.repeat(81) }).name);
  assert.deepEqual(R.validate({ ...ok, name: 'a'.repeat(80) }), {});
});

test('validate dates: bad format, end before start, equal is fine', () => {
  assert.equal(R.validate({ ...ok, startsOn: 'abc' }).startsOn, 'تاريخ البداية غير صالح. اكتبه هكذا: 01-12-2026 (يوم-شهر-سنة)');
  assert.equal(R.validate({ ...ok, endsOn: '99-99-2026' }).endsOn, 'تاريخ النهاية غير صالح. اكتبه هكذا: 01-12-2026 (يوم-شهر-سنة)');
  assert.equal(R.validate({ ...ok, startsOn: '02-12-2026', endsOn: '01-12-2026' }).endsOn, 'تاريخ النهاية قبل تاريخ البداية');
  assert.deepEqual(R.validate({ ...ok, startsOn: '01-12-2026', endsOn: '01-12-2026' }), {});
  assert.deepEqual(R.validate({ ...ok, startsOn: '', endsOn: '   ' }), {});
});

test('only a pending contest can be decided', () => {
  assert.equal(R.canTransition('pending', 'approved'), true);
  assert.equal(R.canTransition('pending', 'rejected'), true);
  assert.equal(R.canTransition('approved', 'rejected'), false);
  assert.equal(R.canTransition('rejected', 'approved'), false);
  assert.equal(R.canTransition('pending', 'pending'), false);
});

test('decisionError: transition, reason, halaqa (approving without a halaqa is blocked)', () => {
  assert.equal(R.decisionError('approved', 'rejected', 'سبب كاف', 'h1'), 'transition');
  assert.equal(R.decisionError('pending', 'rejected', 'ab', null), 'reason');
  assert.equal(R.decisionError('pending', 'rejected', 'x'.repeat(501), null), 'reason');
  assert.equal(R.decisionError('pending', 'rejected', 'سبب كاف', null), null);
  assert.equal(R.decisionError('pending', 'approved', '', null), 'halaqa');
  assert.equal(R.decisionError('pending', 'approved', '', '  '), 'halaqa');
  assert.equal(R.decisionError('pending', 'approved', '', 'h1'), null);
});

test('pickerState by number of linked halaqat', () => {
  assert.equal(R.pickerState([]), 'none');
  assert.equal(R.pickerState(['a']), 'single');
  assert.equal(R.pickerState(['a', 'b']), 'choose');
});

test('filterByStatus keeps all when status is null', () => {
  const items = [{ status: 'pending' }, { status: 'approved' }, { status: 'pending' }];
  assert.equal(R.filterByStatus(items, null).length, 3);
  assert.equal(R.filterByStatus(items, 'pending').length, 2);
});

test('noHalaqaMessage depends on role', () => {
  assert.equal(R.noHalaqaMessage('observer'), 'لم يُربط حسابك بأي حلقة بعد. سيحدد مدير النظام حلقتك عند مراجعة المسابقة.');
  assert.equal(R.noHalaqaMessage('admin'), 'لا توجد حلقة فعّالة لإنشاء مسابقة لها.');
  assert.equal(R.noHalaqaMessage('teacher'), 'لا توجد حلقة مرتبطة بحسابك لإنشاء مسابقة. تواصل مع مدير النظام لربطك بحلقتك.');
});

test('buildSubmitArgs uses the exact RPC argument names and ISO dates', () => {
  const a = R.buildSubmitArgs({ ...ok, name: '  مسابقة رمضان ', startsOn: '٠١-١٢-٢٠٢٦', endsOn: '' }, 'h1');
  assert.deepEqual(a, { p_name: 'مسابقة رمضان', p_title: 'عنوان المسابقة', p_conditions: 'شروط المسابقة كاملة هنا', p_reward: 'جائزة قيمة', p_halaqa: 'h1', p_starts_on: '2026-12-01', p_ends_on: null });
  assert.equal(R.buildSubmitArgs(ok, null).p_halaqa, null);
});

test('buildDecideArgs', () => {
  assert.deepEqual(R.buildDecideArgs('c1', true, ' ', 'h1', true), { p_id: 'c1', p_status: 'approved', p_reason: null, p_halaqa: 'h1', p_link_donor: true });
  assert.deepEqual(R.buildDecideArgs('c1', false, ' سبب ', null, true), { p_id: 'c1', p_status: 'rejected', p_reason: 'سبب', p_halaqa: null, p_link_donor: false });
});
