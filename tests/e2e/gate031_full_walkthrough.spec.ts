import { test, expect, Page } from "@playwright/test";
import fs from "fs";
import path from "path";

const SHOTS = path.resolve("/tmp/opencode/gate031");

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

async function verifyNoHorizontalOverflow(page: Page) {
  const isOverflowing = await page.evaluate(() => {
    return document.documentElement.scrollWidth > window.innerWidth;
  });
  expect(isOverflowing).toBe(false);
}

test.describe("GATE 031 — Complete System Walkthrough & Route Verification", () => {
  test.beforeEach(async ({ page }) => {
    // Collect console errors
    page.on("pageerror", (err) => {
      console.error("Unhandled Page Error:", err.message);
    });
  });

  test("1. Public Storefront Navigation (/ , /products, /services, /warranty)", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    // Homepage
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.locator("h1")).toContainText(/Tyres|Well Lups/i);
    await verifyNoHorizontalOverflow(page);
    await shoot(page, "01_public_home");

    // Products
    await page.goto("/products", { waitUntil: "networkidle" });
    await expect(page.locator("h1")).toContainText(/Tyres|Product/i);
    await verifyNoHorizontalOverflow(page);
    await shoot(page, "02_public_products");

    // Services
    await page.goto("/services", { waitUntil: "networkidle" });
    await expect(page.locator("h1")).toContainText(/Services/i);
    await verifyNoHorizontalOverflow(page);
    await shoot(page, "03_public_services");

    // Warranty
    await page.goto("/warranty", { waitUntil: "networkidle" });
    await expect(page.locator("h1")).toContainText(/Warranty/i);
    await verifyNoHorizontalOverflow(page);
    await shoot(page, "04_public_warranty");
  });

  test("2. Guest Token Flows (/quotes/[id], /bookings/[id])", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    // Non-existent quote with invalid token
    await page.goto("/quotes/00000000-0000-0000-0000-000000000000?token=invalid", { waitUntil: "networkidle" });
    await expect(page.locator("body")).toBeVisible();
    await verifyNoHorizontalOverflow(page);
    await shoot(page, "05_guest_quote_invalid");

    // Non-existent booking with invalid token
    await page.goto("/bookings/00000000-0000-0000-0000-000000000000?token=invalid", { waitUntil: "networkidle" });
    const emptyBooking = page.locator("[data-testid='booking-not-found']");
    await expect(emptyBooking).toBeVisible({ timeout: 15000 });
    await expect(emptyBooking).toContainText("Booking Not Found");
    await verifyNoHorizontalOverflow(page);
    await shoot(page, "06_guest_booking_invalid");
  });

  test("3. Admin Navigation & Full Surface Walkthrough", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    // Navigate to /admin (redirects to /admin/quotes)
    await page.goto("/admin", { waitUntil: "networkidle" });
    await ensureSignedOut(page);

    // Sign in as Admin
    const adminQuick = page.locator("[data-testid='login-admin-quick']");
    if (await adminQuick.isVisible().catch(() => false)) {
      await adminQuick.click();
    } else {
      await page.fill("[data-testid='staff-login-email']", "admin@test.local");
      await page.fill("[data-testid='staff-login-password']", "TestPassword123!");
      await page.click("[data-testid='staff-login-btn']");
    }

    await expect(page.locator("[data-testid='staff-session-bar']")).toBeVisible({ timeout: 15000 });
    await expect(page.locator("[data-testid='staff-role']")).toContainText("ADMIN");
    await verifyNoHorizontalOverflow(page);
    await shoot(page, "07_admin_quotes_queue");

    // Bookings Queue
    await page.goto("/admin/bookings", { waitUntil: "networkidle" });
    await expect(page.locator("h1")).toContainText(/Booking/i);
    await verifyNoHorizontalOverflow(page);
    await shoot(page, "08_admin_bookings_queue");

    // Products Management
    await page.goto("/admin/products", { waitUntil: "networkidle" });
    await expect(page.locator("h1")).toContainText(/Product Catalogue/i);
    await expect(page.locator("button:has-text('Add Product')")).toBeVisible({ timeout: 15000 });
    await verifyNoHorizontalOverflow(page);
    await shoot(page, "09_admin_products_panel");

    // Product CSV Import
    await page.goto("/admin/products/import", { waitUntil: "networkidle" });
    await expect(page.locator("h1")).toContainText(/Import Products/i);
    await expect(page.locator("a[href='/import-templates/products.csv']")).toBeVisible();
    await verifyNoHorizontalOverflow(page);
    await shoot(page, "10_admin_products_import");

    // Services Management
    await page.goto("/admin/services", { waitUntil: "networkidle" });
    await expect(page.locator("h1")).toContainText(/Services/i);
    await verifyNoHorizontalOverflow(page);
    await shoot(page, "11_admin_services_panel");

    // Services CSV Import
    await page.goto("/admin/services/import", { waitUntil: "networkidle" });
    await expect(page.locator("h1")).toContainText(/Import Services/i);
    await verifyNoHorizontalOverflow(page);
    await shoot(page, "12_admin_services_import");

    // Staff Administration
    await page.goto("/admin/staff", { waitUntil: "networkidle" });
    await expect(page.locator("h1")).toContainText(/Staff Access/i);
    await verifyNoHorizontalOverflow(page);
    await shoot(page, "13_admin_staff_panel");

    // Settings
    await page.goto("/admin/settings", { waitUntil: "networkidle" });
    await expect(page.locator("h1")).toContainText(/Admin Settings|Settings/i);
    await verifyNoHorizontalOverflow(page);
    await shoot(page, "14_admin_settings_panel");
  });

  test("4. Manager Navigation & Boundary Verification", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.goto("/admin/quotes", { waitUntil: "networkidle" });
    await ensureSignedOut(page);

    // Sign in as Manager
    const mgrQuick = page.locator("[data-testid='login-manager-quick']");
    if (await mgrQuick.isVisible().catch(() => false)) {
      await mgrQuick.click();
    } else {
      await page.fill("[data-testid='staff-login-email']", "mgr@test.local");
      await page.fill("[data-testid='staff-login-password']", "TestPassword123!");
      await page.click("[data-testid='staff-login-btn']");
    }

    await expect(page.locator("[data-testid='staff-session-bar']")).toBeVisible({ timeout: 15000 });
    await expect(page.locator("[data-testid='staff-role']")).toContainText("MANAGER");
    await shoot(page, "15_manager_quotes_view");

    // Manager blocked from products catalog writes
    await page.goto("/admin/products", { waitUntil: "networkidle" });
    const blockedMsg = page.locator("[data-testid='products-unauthorized']");
    await expect(blockedMsg).toBeVisible({ timeout: 15000 });
    await expect(blockedMsg).toContainText("access denied");
    await shoot(page, "16_manager_products_blocked");
  });

  test("5. Cashier POS Terminal (/pos)", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.goto("/pos", { waitUntil: "networkidle" });
    await ensureSignedOut(page);

    // Sign in as Cashier
    const cashierQuick = page.locator("[data-testid='login-cashier-quick']");
    if (await cashierQuick.isVisible().catch(() => false)) {
      await cashierQuick.click();
    } else {
      await page.fill("[data-testid='staff-login-email']", "cashier@test.local");
      await page.fill("[data-testid='staff-login-password']", "TestPassword123!");
      await page.click("[data-testid='staff-login-btn']");
    }

    await expect(page.locator("[data-testid='staff-session-bar']")).toBeVisible({ timeout: 15000 });
    await expect(page.locator("[data-testid='staff-role']")).toContainText("CASHIER");

    // Terminal renders with empty catalog and cart
    const terminal = page.locator("[data-testid='pos-terminal']");
    await expect(terminal).toBeVisible({ timeout: 15000 });
    await expect(page.locator("[data-testid='pos-empty-catalog']")).toBeVisible();
    await expect(page.locator("[data-testid='empty-cart-state']")).toBeVisible();
    await verifyNoHorizontalOverflow(page);
    await shoot(page, "17_cashier_pos_terminal");
  });
});
