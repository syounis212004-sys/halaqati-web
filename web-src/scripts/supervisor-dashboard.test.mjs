import test from "node:test";
import assert from "node:assert/strict";
import {
  dashboard,
  halaqaCard,
  welcome,
} from "../src/features/supervisor/dashboard.mjs";

const e = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const decode = (value) =>
  value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
const circle = {
  id: "circle-1",
  name: "حلقة <اختبار>",
  names: ['د. عبد الله "أبو يونس" حسن'],
  tids: ["teacher-1"],
  state: "none",
  students: 44,
  recited: 11,
  present: 30,
  absent: 10,
  excused: 4,
  monthSessions: 8,
  lastVisit: null,
};
const options = {
  detailed: false,
  daysSince: () => 20,
  formatNumber: String,
  escape: e,
  labels: {
    none: "لم تبدأ الجلسة",
    open: "الجلسة جارية",
    closed: "انتهت الجلسة",
  },
};

test("circle keeps persisted attendance and recitation progress", () => {
  const html = halaqaCard(circle, options);
  assert.match(html, /aria-valuenow="25"/);
  for (const value of [30, 10, 4])
    assert.ok(html.includes(`<dd>${value}</dd>`));
  assert.ok(html.includes("11 من 44"));
});

test("quoted teacher names survive the existing alert action without script injection", () => {
  const malicious = { ...circle, names: [`أبو "يونس"');window.bad=true;//`] };
  const html = halaqaCard(malicious, options);
  const attribute = html.match(/onclick="(RC50\.s3\.alert[^"]*)"/)[1];
  let received;
  Function(
    "RC50",
    decode(attribute),
  )({
    s3: {
      alert(...args) {
        received = args;
      },
    },
  });
  assert.deepEqual(received, [
    "teacher-1",
    malicious.names[0],
    "circle-1",
    "1",
  ]);
  assert.ok(html.includes("حلقة &lt;اختبار&gt;"));
});

test("an unassigned teacher disables the alert but leaves visit available", () => {
  const html = halaqaCard({ ...circle, tids: [], names: [] }, options);
  assert.match(html, /disabled onclick="RC50\.s3\.alert/);
  assert.match(html, /onclick="RC50\.s3\.visitNew/);
});

test("attention combines session and visit information once per circle", () => {
  const html = dashboard(
    {
      halaqas: [circle],
      pending: [circle],
      stale: [circle],
      started: 0,
      weekVisits: 0,
      openActions: 0,
      welcome: "",
    },
    { escape: e, renderCircle: () => "" },
  );
  assert.equal((html.match(/<li>/g) || []).length, 1);
  assert.ok(html.includes("لم تبدأ جلسة اليوم"));
  assert.ok(html.includes("لم تُسجّل زيارة بعد"));
});

test("an empty supervisor scope does not claim all circles have started", () => {
  const html = dashboard(
    {
      halaqas: [],
      pending: [],
      stale: [],
      started: 0,
      weekVisits: 0,
      openActions: 0,
      welcome: "",
    },
    { escape: e, renderCircle: () => "" },
  );
  assert.ok(html.includes("بانتظار إسناد حلقة"));
  assert.ok(!html.includes("الجميع على الموعد"));
});

test("welcome escapes profile and quotation content while retaining an inline avatar slot", () => {
  const html = welcome(
    {
      name: "<script>bad()</script>",
      greeting: "صباح الخير",
      avatar: "<span>س</span>",
      quote: "قول & نص",
      source: "مرجع",
    },
    e,
  );
  assert.ok(html.includes("&lt;script&gt;bad()&lt;/script&gt;"));
  assert.ok(html.includes("قول &amp; نص"));
  assert.match(html, /data-supervisor-avatar aria-hidden="true"><span>س/);
});

import { programsPage, teacherCard } from "../src/features/supervisor/supervision.mjs";

test("programs page shows progress, participants and escapes names", () => {
  const p = { id: "p1", name: "دورة <تأهيلية>", kind: "برنامج تدريب", starts: "2026-10-04", ends: "2027-01-31", tids: ["t1"], names: ['أ "ب"'], students: 14, monthSessions: 3, recited: 0, last: "2026-11-03", state: "none" };
  const html = programsPage([p], { e, today: "2026-11-15" });
  assert.match(html, /aria-valuenow="\d+"/);
  assert.ok(!html.includes("NaN"));
  assert.ok(!html.includes("<تأهيلية>"));
  assert.match(html, /14/);
});

test("a teacher without a halaqa is not flagged as needing follow-up", () => {
  const html = teacherCard({ id: "t", name: "علاء", halaqat: [], pct: null, sessions: 0, days: 0, monthDays: 8, closed: 0, rec: 0, today: "none", last: "—", visits: 0, score: null, openActions: 0 }, { e, num1: String, open: false });
  assert.match(html, /بلا حلقة/);
  assert.ok(!html.includes("يحتاج متابعة"));
});

test("teacher card shows every evaluation metric with its percentage", () => {
  const metrics = [["commit", "الالتزام بالحضور", 100], ["attend", "حضور الطلاب", 80], ["recite", "تغطية التسميع", 43], ["closed", "إنهاء الجلسات", 0], ["visit", "تقييم الزيارات", null]].map(([k, label, pct]) => ({ k, label, hint: label, pct }));
  const html = teacherCard({ id: "t", name: "محفّظ", halaqat: [{ id: "h", name: "حلقة" }], pct: 69, metrics, sessions: 12, days: 12, monthDays: 12, closed: 0, rec: 300, today: "none", last: "2026-11-13", visits: 0, score: null, openActions: 0 }, { e, num1: String, open: false });
  assert.equal((html.match(/class="sv-pm"/g) || []).length, 5);
  assert.match(html, /أداء جيد/);
  assert.match(html, /43%/);
});
