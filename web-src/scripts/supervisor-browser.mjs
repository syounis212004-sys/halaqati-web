import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs";

const baseURL = process.env.BASE_URL || "http://127.0.0.1:4181/";
const output = process.env.ARTIFACTS_DIR || ".artifacts/supervisor";
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
});
const failures = [];
const AxeBuilder = process.env.AXE_MODULE
  ? (await import(process.env.AXE_MODULE)).default
  : null;
async function checkAccessibility(page, label) {
  if (!AxeBuilder) return;
  const result = await new AxeBuilder({ page })
    .include(".sv-dashboard")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  fs.writeFileSync(
    `${output}/accessibility-${label}.json`,
    JSON.stringify(result, null, 2),
  );
  assert.deepEqual(
    result.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
    [],
    `dashboard accessibility: ${label}`,
  );
}
for (const width of process.env.CAPTURE_BEFORE
  ? [390]
  : process.env.VIEWPORTS
    ? process.env.VIEWPORTS.split(",").map(Number)
    : [360, 390, 768, 1024, 1440]) {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    locale: "ar",
    serviceWorkers: "block",
  });
  const origin = new URL(baseURL).origin;
  await context.route("**/*", (route) =>
    new URL(route.request().url()).origin === origin
      ? route.continue()
      : route.abort(),
  );
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(baseURL);
  await page.waitForFunction(() => window.RC86 && window.RC50?.s3);
  await page.evaluate(async () => {
    const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
    const teacher = {
      id: id(2),
      role: "teacher",
      active: true,
      full_name: 'د. عبد الله "أبو يونس" حسن عبد الرحمن',
    };
    state.user = { id: id(1) };
    state.profile = {
      id: id(1),
      role: "supervisor",
      active: true,
      approval_status: "approved",
      full_name: "سارة يونس عبد الرحمن — مشرفة الحلقات",
    };
    state.page = "home";
    state.offline = true;
    state.networkVerified = false;
    state.halaqas = [
      {
        id: id(3),
        name: "حلقة معاوية بن أبي سفيان",
        active: true,
        halaqa_type: "regular",
        supervisor_id: id(1),
      },
    ];
    state.students = Array.from({ length: 44 }, (_, index) => ({
      id: id(100 + index),
      full_name: `طالب اختبار ${index}`,
      status: "active",
      halaqa_id: id(3),
    }));
    state.sessions = [];
    state.profiles = [state.profile, teacher];
    const tables = {
      profiles: [state.profile, teacher],
      halaqas: state.halaqas,
      halaqa_teachers: [{ halaqa_id: id(3), teacher_id: id(2) }],
      sessions: [],
      supervisor_visits: [],
      attendance_records: [],
      recitation_entries: [],
    };
    db.from = (table) => {
      let rows = tables[table] || [];
      const query = {
        select() {
          return query;
        },
        eq(key, value) {
          rows = rows.filter((row) => row[key] === value);
          return query;
        },
        in(key, values) {
          rows = rows.filter((row) => values.includes(row[key]));
          return query;
        },
        gte() {
          return query;
        },
        neq() {
          return query;
        },
        order() {
          return query;
        },
        limit() {
          return query;
        },
        then(resolve, reject) {
          return Promise.resolve({ data: rows, error: null }).then(
            resolve,
            reject,
          );
        },
      };
      return query;
    };
    db.rpc = async () => ({ data: [], error: null });
    document.getElementById("auth").classList.add("hidden");
    document.getElementById("app").classList.remove("hidden");
    document.getElementById("rc27Splash")?.remove();
    await render();
    buildMobileNav();
  });
  await page.waitForSelector(".s3-welcome");
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({
    path: `${output}/${process.env.CAPTURE_BEFORE ? "before" : "after"}-${width}.png`,
    fullPage: true,
    animations: "disabled",
  });
  const geometry = await page.evaluate(() => {
    const welcome = document
      .querySelector(".s3-welcome")
      .getBoundingClientRect();
    const avatar = document
      .querySelector(".s3-welcome .rc85-ph")
      ?.getBoundingClientRect();
    const button = [...document.querySelectorAll("#content button")].find(
      (element) => element.textContent.trim() === "تنبيه",
    );
    const rect = button?.getBoundingClientRect();
    return {
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      avatarInside:
        avatar &&
        avatar.top >= welcome.top &&
        avatar.left >= welcome.left &&
        avatar.right <= welcome.right &&
        avatar.bottom <= welcome.bottom,
      alertWidth: rect?.width,
    };
  });
  if (!geometry.avatarInside)
    failures.push(`${width}: avatar escapes welcome card`);
  if (geometry.overflow) failures.push(`${width}: horizontal overflow`);
  if (geometry.alertWidth < 60)
    failures.push(
      `${width}: alert button squeezed to ${geometry.alertWidth}px`,
    );
  if (!process.env.CAPTURE_BEFORE) {
    assert.equal(await page.locator(".sv-dashboard").count(), 1);
    await checkAccessibility(page, `light-${width}`);
    assert.equal(
      await page.locator("#nav button").count(),
      await page.evaluate(() => navItems().length),
      "all authorized menu destinations are retained",
    );
    if (width < 1000) {
      assert.equal(await page.locator("#mobileNav .sv-tab:visible").count(), 5);
      assert.ok(
        await page
          .locator("#mobileNav .sv-tab")
          .evaluateAll((buttons) =>
            buttons.every(
              (button) =>
                button.getBoundingClientRect().width >= 44 &&
                button.getBoundingClientRect().width <= innerWidth / 4,
            ),
          ),
        "five distinct, tappable navigation slots",
      );
      assert.ok(
        await page
          .locator("#mobileNav .sv-tab>span")
          .evaluateAll((labels) =>
            labels.every((label) => getComputedStyle(label).display !== "none"),
          ),
        "navigation labels stay visible",
      );
    }
    assert.ok((await page.locator("#content").innerText()).includes("44"));
    await page.getByRole("button", { name: "تنبيه", exact: true }).click();
    assert.ok(
      await page.locator("#s3Alert").isVisible(),
      "alert action still opens the existing teacher dialog",
    );
    assert.ok(
      (await page.locator("#s3Alert").innerText()).includes("أبو يونس"),
      "quoted teacher names remain safe in action arguments",
    );
    await page.evaluate(() => RC50.closeSheet("s3Alert"));
    await page
      .getByRole("button", { name: "تسجيل زيارة", exact: true })
      .click();
    assert.ok(await page.locator("#s3Visit").isVisible());
    assert.equal(
      await page.locator("#s3VH").inputValue(),
      "00000000-0000-4000-8000-000000000003",
    );
    await page.evaluate(() => RC50.closeSheet("s3Visit"));
    await page.evaluate(async () => {
      RC50.k85.myPhoto =
        "data:image/svg+xml;base64," +
        btoa(
          '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#c9a227"/><circle cx="50" cy="40" r="20" fill="#fff"/></svg>',
        );
      await render();
    });
    await page.waitForSelector("[data-supervisor-avatar] img");
    assert.equal(
      await page
        .locator("[data-supervisor-avatar] img")
        .evaluate((img) => getComputedStyle(img).objectFit),
      "cover",
    );
    await page.evaluate(() => document.body.classList.add("dark"));
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({
      path: `${output}/dark-${width}.png`,
      fullPage: true,
      animations: "disabled",
    });
    await checkAccessibility(page, `dark-${width}`);
    await page.evaluate(() => toggleDrawer(true));
    await page.waitForFunction(() => {
      const r = document.getElementById("drawer").getBoundingClientRect();
      return r.right <= innerWidth + 1 && r.left >= -1;
    });
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({
      path: `${output}/menu-${width}.png`,
      fullPage: true,
      animations: "disabled",
    });
    assert.ok(
      await page.locator("#nav button").evaluateAll((buttons) =>
        buttons.every((button) => {
          const r = button.getBoundingClientRect();
          return r.left >= 0 && r.right <= innerWidth + 1;
        }),
      ),
      "drawer actions stay inside the viewport",
    );
    await page.keyboard.press("Escape");
    assert.ok(
      !(await page
        .locator("#drawer")
        .evaluate((element) => element.classList.contains("open"))),
    );
    await page.evaluate(() => {
      const sizes = [...document.querySelectorAll(".sv-dashboard *")].map(
        (el) => [el, parseFloat(getComputedStyle(el).fontSize)],
      );
      for (const [el, size] of sizes) el.style.fontSize = `${size * 2}px`;
    });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      "200% text does not overflow",
    );
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({
      path: `${output}/large-text-${width}.png`,
      fullPage: true,
      animations: "disabled",
    });
    await page.evaluate(() => {
      state.profile.role = "teacher";
      buildNav();
      buildMobileNav();
    });
    assert.equal(
      await page.locator("body.sv-shell").count(),
      0,
      "supervisor chrome is removed when the role changes",
    );
  }
  failures.push(...errors.map((error) => `${width}: ${error}`));
  await context.close();
}
await browser.close();
console.log(JSON.stringify({ failures }, null, 2));
assert.deepEqual(failures, []);
