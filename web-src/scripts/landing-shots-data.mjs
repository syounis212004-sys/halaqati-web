/* Fictional RPC answers for the landing screenshots. Every name is a label ("طالب تجريبي", "حلقة تجريبية"); every number is illustrative. */
import { idn } from './landing-shots-lib.mjs';

const H = [{ id: idn(10), name: 'حلقة تجريبية (أ)' }, { id: idn(11), name: 'حلقة تجريبية (ب)' }];
const contest = (n, status, extra = {}) => ({ id: idn(n), name: 'مسابقة تجريبية', title: 'مسابقة الحفظ الشهرية', conditions: 'حفظ عدد من الصفحات خلال الشهر مع المراجعة', reward: 'هدية رمزية', status, halaqa_id: idn(10), halaqa_name: H[0].name, donor_name: 'مانح تجريبي', ...extra });

const dayRows = (n) => Array.from({ length: n }, (_, k) => { const i = n - 1 - k; const d = new Date(); d.setDate(d.getDate() - i); return { date: d.toISOString().slice(0, 10), hifz: i % 4 === 0 ? 0 : 1 + (i % 3) * 0.5, review: i % 2 ? 2 : 1, sard: 0, safety: 90 + (i % 7) }; });
const dash = (args) => ({ hifz_pages: 14.5, review_pages: 22, sard_pages: 0, attendance_days: 9, absent_days: 1, ranks: { hifz: { halaqa_rank: 2, halaqa_total: 12, category_rank: 1, category_total: 6, pages: 14.5 } }, daily: dayRows(30), student_id: args && args.p_student_id });

const teachers = [1, 2, 3].map((n) => ({ id: idn(300 + n), role: 'teacher', active: true, approval_status: 'approved', full_name: `محفّظ تجريبي ${n}`, phone: null }));
export const TABLES = {
  profiles: [{ id: idn(1), role: 'supervisor', active: true, approval_status: 'approved', full_name: 'مشرف تجريبي' }, ...teachers,
    ...[['guardian', 'approved'], ['guardian', 'approved'], ['guardian', 'pending'], ['observer', 'pending'], ['teacher', 'pending']].map(([role, st], i) => ({ id: idn(400 + i), role, requested_role: role, active: st !== 'rejected', approval_status: st, full_name: `${({ guardian: 'ولي أمر', observer: 'مانح', teacher: 'محفّظ' })[role]} تجريبي ${i + 4}`, email: `user${i}@example.invalid`, created_at: new Date().toISOString() }))],
  halaqas: [10, 11, 12].map((n, i) => ({ id: idn(n), name: ['حلقة تجريبية (أ)', 'حلقة تجريبية (ب)', 'حلقة تجريبية (ج)'][i], active: true, halaqa_type: 'regular', supervisor_id: idn(1) })),
  sessions: [10, 11, 12].flatMap((n, i) => [0, 1, 2, 3, 4].map((d) => { const dt = new Date(); dt.setDate(dt.getDate() - d); return { id: idn(500 + i * 10 + d), halaqa_id: idn(n), session_date: dt.toISOString().slice(0, 10), status: d === 0 && i === 2 ? 'open' : 'closed', created_by: teachers[i].id }; })),
  halaqa_teachers: teachers.map((t, i) => ({ halaqa_id: idn(10 + i), teacher_id: t.id, profile_id: t.id })),
  halaqa_supervisors: [idn(10), idn(11), idn(12)].map((h) => ({ halaqa_id: h, supervisor_id: idn(1) })),
};
const ym = new Date().toISOString().slice(0, 10);
const staffOv = teachers.map((t, i) => ({ id: t.id, session_days: 14 - i * 3, sessions: 16 - i * 3, closed_sessions: 15 - i * 3, recitations: 180 - i * 40, last_session: ym }));

export const RPC = {
  rc53_staff_overview: staffOv,
  guardian_student_dashboard_range: dash({}),
  rc182_refresh_student_badges_exact: [],
  contest_admin_list: [contest(30, 'pending', { title: 'أفضل حافظ للشهر' }), contest(31, 'approved', { title: 'مراجعة الجزء الأخير', reward: 'شهادة تقدير' }), contest(32, 'rejected', { title: 'مسابقة تجريبية أخرى', reject_reason: 'الشروط غير واضحة' })],
  contest_my: [contest(20, 'approved'), contest(21, 'pending', { title: 'مراجعة الأسبوع' })],
  contest_visible: [contest(40, 'approved', { title: 'مسابقة حلقتك' })],
  contest_donor_halaqas: H,
  rc49_support_cards: [
    { id: idn(50), kind: 'teacher', title: 'دعم حلقة تجريبية', description: 'دعم شهري لحلقة تجريبية', recurrence: 'monthly', slots: 1, beneficiaries: 5, status: 'open', halaqa_id: idn(10), halaqa_name: H[0].name, amount: 50, currency: 'ILS', periods: [{ period: 'يناير', taken: 0, mine: null }, { period: 'فبراير', taken: 1, mine: null }], pay: {} },
    { id: idn(51), kind: 'award', title: 'جوائز طلاب الحلقة', description: 'جوائز تشجيعية للمتميزين في الحلقة', recurrence: 'monthly', slots: 2, beneficiaries: 1, status: 'open', halaqa_id: idn(11), halaqa_name: H[1].name, amount: 30, currency: 'ILS', periods: [{ period: 'يناير', taken: 1, mine: null }, { period: 'فبراير', taken: 0, mine: null }], pay: {} },
  ],
  rc49_support_defaults: {},
  rc49_my_pledges: [],
  rc66_my_subscription: null,
};
