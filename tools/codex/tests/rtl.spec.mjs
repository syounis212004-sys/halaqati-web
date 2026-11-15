import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.beforeEach(async ({ page, baseURL }) => {
  const origin = new URL(baseURL).origin;
  // All test data is synthetic: prevent requests to Supabase and other remote services.
  await page.route("**/*", (route) =>
    new URL(route.request().url()).origin === origin
      ? route.continue()
      : route.abort(),
  );
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.HalaqatiCertificates));
  await page
    .locator("#rc27Splash")
    .evaluate((element) => element.remove())
    .catch(() => {});
  await page.evaluate(() => document.fonts.ready);
});

for (const theme of ["light", "dark"]) {
  test(`Arabic login, ${theme} theme and responsive screenshot`, async ({
    page,
  }, testInfo) => {
    await page.evaluate(
      (dark) => document.body.classList.toggle("dark", dark),
      theme === "dark",
    );
    await expect(page.locator("html")).toHaveAttribute("lang", /^ar/);
    expect(
      await page
        .locator("html")
        .evaluate((element) => getComputedStyle(element).direction),
    ).toBe("rtl");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await testInfo.attach(`${theme}-login`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });
    if (process.env.VISUAL_BASELINE === "1") {
      await expect(page).toHaveScreenshot(`${theme}-login.png`, {
        fullPage: true,
        animations: "disabled",
      });
    }
  });
}

test("WCAG 2.2 AA login accessibility", async ({ page }, testInfo) => {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  await testInfo.attach("accessibility", {
    body: JSON.stringify(result.violations, null, 2),
    contentType: "application/json",
  });
  expect(
    result.violations,
    "Existing violations remain visible; do not weaken this check to pass CI",
  ).toEqual([]);
});
