/* Isolated, fictional state for the landing-page product demo. No network, no storage, no real data. */
export const TOTAL_PAGES = 604;

export const DEMO_STUDENTS = [
  { id: 'd1', name: 'طالب تجريبي 1', pages: 41, points: 120, demo: true },
  { id: 'd2', name: 'طالبة تجريبية 2', pages: 18.5, points: 64, demo: true },
  { id: 'd3', name: 'طالب تجريبي 3', pages: 96, points: 210, demo: true },
];

const LEVELS = [
  { key: 'excellent', label: 'ممتاز', points: 10, passed: true, max: 0 },
  { key: 'very_good', label: 'جيد جدًا', points: 8, passed: true, max: 2 },
  { key: 'good', label: 'جيد', points: 6, passed: true, max: 4 },
  { key: 'redo', label: 'يحتاج إعادة', points: 0, passed: false, max: Infinity },
];

export function evaluate(mistakes) {
  const n = Math.max(0, Math.floor(Number(mistakes) || 0));
  return LEVELS.find((l) => n <= l.max);
}

export function createDemo() {
  const students = {};
  DEMO_STUDENTS.forEach((s) => { students[s.id] = { pages: s.pages, points: s.points }; });
  return { students, log: [] };
}

export function recite(demo, { studentId, pages, mistakes }) {
  const st = demo.students[studentId];
  if (!st) throw new Error('unknown demo student');
  const level = evaluate(mistakes);
  const amount = Math.max(0, Number(pages) || 0);
  if (level.passed) {
    st.pages = Math.min(TOTAL_PAGES, st.pages + amount);
    st.points += level.points;
  }
  const entry = { studentId, pages: amount, mistakes: Math.max(0, Math.floor(Number(mistakes) || 0)), level: level.key, passed: level.passed };
  demo.log.push(entry);
  return { ...entry, label: level.label, points: level.passed ? level.points : 0 };
}

export function summary(demo) {
  const passed = demo.log.filter((e) => e.passed).length;
  return { recitations: demo.log.length, passed, needRepeat: demo.log.length - passed };
}
