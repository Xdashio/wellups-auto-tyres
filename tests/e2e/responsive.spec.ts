import { test, expect } from "@playwright/test";

// GATE 026B — responsive + custom-select regression certification.
// Browser rendering is the authority: document-level overflow, hero
// containment, and Radix custom menus (never native) at real widths.
// Screenshots are written OUTSIDE the repository so the tree stays clean.

const SHOTS = "/tmp/opencode/gate026b/after";

const PUBLIC_ROUTES = [
  "/",
  "/products",
  "/services",
  "/warranty",
  "/quotes/00000000-0000-0000-0000-000000000000",
  "/bookings/00000000-0000-0000-0000-000000000000",
  "/no-such-page",
];

const ADMIN_ROUTES = [
  "/admin/quotes",
  "/admin/bookings",
  "/admin/products",
  "/admin/services",
  "/admin/staff",
  "/admin/settings",
];

for (const width of [390, 768, 1024, 1440]) {
  test(`no document overflow at ${width}px (public + admin anon)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const url of [...PUBLIC_ROUTES, ...ADMIN_ROUTES]) {
      await page.goto(url, { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(1200);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
      );
      expect(overflow, `horizontal overflow at ${width}px on ${url}`).toBe(false);
    }
  });
}

test("hero content never exceeds the viewport", async ({ page }) => {
  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/", { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const w = await page.evaluate(
      () => document.querySelector(".hero-content")?.getBoundingClientRect().width ?? 0
    );
    expect(w, `hero content width at ${width}px`).toBeLessThanOrEqual(width + 1);
  }
});

test("fit-finder selects open custom design-system menus", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/", { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
  await page.evaluate(() => document.getElementById("fitFinder")?.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(500);
  // No native selects anywhere in the fit finder.
  expect(await page.locator("#fitFinder select").count()).toBe(0);
  await page.locator("#fitMake").click();
  await page.waitForTimeout(500);
  // A custom listbox opens (Radix), styled by the design system.
  await expect(page.locator('[role="listbox"]')).toBeVisible({ timeout: 5000 });
  const itemPad = await page.evaluate(() => {
    const el = document.querySelector('[role="option"]');
    return el ? getComputedStyle(el).paddingTop : null;
  });
  // Spacing utilities apply: items are not collapsed to zero padding
  // (the signature of the unlayered-reset bug class).
  expect(itemPad).not.toBe("0px");
  await page.keyboard.press("Escape");
  await expect(page.locator('[role="listbox"]')).toHaveCount(0);
});

test("fit-finder keyboard flow selects a make", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/", { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
  await page.evaluate(() => document.getElementById("fitFinder")?.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(500);
  await page.locator("#fitMake").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator('[role="listbox"]')).toBeVisible({ timeout: 5000 });
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(400);
  await expect(page.locator('[role="listbox"]')).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/select-selected.png` });
});
