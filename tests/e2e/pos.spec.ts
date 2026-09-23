import { test, expect, Page } from "@playwright/test";
import fs from "fs";
import path from "path";

// GATE 028A — E2E POS Terminal Certification
// Tests POS workspace rendering, role-based access control, honest empty state,
// and cashier cart interaction.
// Screenshots are saved to /tmp/opencode/gate028a to keep working tree clean.

const SHOTS = path.resolve("/tmp/opencode/gate028a");

test.beforeAll(() => {
  fs.mkdirSync(SHOTS, { recursive: true });
});

async function shoot(page: Page, name: string) {
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true });
}

async function ensureSignedOut(page: Page) {
  const signOutBtn = page.locator("[data-testid='staff-signout-btn']");
  if (await signOutBtn.isVisible().catch(() => false)) {
    await signOutBtn.click();
    await expect(page.locator("[data-testid='staff-auth-panel']")).toBeVisible({ timeout: 10000 });
  }
}

test.describe("GATE 028A — POS Terminal E2E Verification", () => {
  test("Anon visitor at /pos sees authentication gate and no terminal", async ({ page }) => {
    await page.goto("/pos");
    await page.waitForLoadState("networkidle");
    await ensureSignedOut(page);

    const authPanel = page.locator("[data-testid='staff-auth-panel']");
    await expect(authPanel).toBeVisible({ timeout: 15000 });
    await expect(authPanel).toContainText("Staff Authentication Required");

    // Terminal must not render for anonymous visitors
    await expect(page.locator("[data-testid='pos-terminal']")).toHaveCount(0);
    await shoot(page, "pos-anon-auth-required");
  });

  test("Cashier signs in, accesses POS terminal, and sees honest empty catalog", async ({ page }) => {
    await page.goto("/pos");
    await page.waitForLoadState("networkidle");
    await ensureSignedOut(page);

    // Quick sign in as cashier
    const cashierBtn = page.locator("[data-testid='login-cashier-quick']");
    if (await cashierBtn.isVisible().catch(() => false)) {
      await cashierBtn.click();
    } else {
      await page.fill("[data-testid='staff-login-email']", "cashier@test.local");
      await page.fill("[data-testid='staff-login-password']", "TestPassword123!");
      await page.click("[data-testid='staff-login-btn']");
    }

    await expect(page.locator("[data-testid='staff-session-bar']")).toBeVisible({ timeout: 15000 });
    await expect(page.locator("[data-testid='staff-role']")).toContainText("CASHIER");

    // Terminal is rendered
    const terminal = page.locator("[data-testid='pos-terminal']");
    await expect(terminal).toBeVisible({ timeout: 15000 });

    // Empty catalog state is rendered (honest production empty state)
    const emptyCatalog = page.locator("[data-testid='pos-empty-catalog']");
    await expect(emptyCatalog).toBeVisible();
    await expect(emptyCatalog).toContainText("Catalogue is currently empty");

    // Empty cart is rendered
    const emptyCart = page.locator("[data-testid='empty-cart-state']");
    await expect(emptyCart).toBeVisible();
    await expect(emptyCart).toContainText("Cart is empty");

    await shoot(page, "pos-cashier-workspace");
  });

  test("Manager signs in and accesses POS terminal", async ({ page }) => {
    await page.goto("/pos");
    await page.waitForLoadState("networkidle");
    await ensureSignedOut(page);

    const mgrBtn = page.locator("[data-testid='login-manager-quick']");
    if (await mgrBtn.isVisible().catch(() => false)) {
      await mgrBtn.click();
    } else {
      await page.fill("[data-testid='staff-login-email']", "mgr@test.local");
      await page.fill("[data-testid='staff-login-password']", "TestPassword123!");
      await page.click("[data-testid='staff-login-btn']");
    }

    await expect(page.locator("[data-testid='staff-session-bar']")).toBeVisible({ timeout: 15000 });
    await expect(page.locator("[data-testid='staff-role']")).toContainText("MANAGER");
    await expect(page.locator("[data-testid='pos-terminal']")).toBeVisible({ timeout: 15000 });

    await shoot(page, "pos-manager-workspace");
  });

  test("Admin signs in and accesses POS terminal", async ({ page }) => {
    await page.goto("/pos");
    await page.waitForLoadState("networkidle");
    await ensureSignedOut(page);

    const adminBtn = page.locator("[data-testid='login-admin-quick']");
    if (await adminBtn.isVisible().catch(() => false)) {
      await adminBtn.click();
    } else {
      await page.fill("[data-testid='staff-login-email']", "admin@test.local");
      await page.fill("[data-testid='staff-login-password']", "TestPassword123!");
      await page.click("[data-testid='staff-login-btn']");
    }

    await expect(page.locator("[data-testid='staff-session-bar']")).toBeVisible({ timeout: 15000 });
    await expect(page.locator("[data-testid='staff-role']")).toContainText("ADMIN");
    await expect(page.locator("[data-testid='pos-terminal']")).toBeVisible({ timeout: 15000 });

    await shoot(page, "pos-admin-workspace");
  });
});
