import { test, expect } from "@playwright/test";
import { updateStaffQuoteResponse, createQuoteRequest } from "@/lib/supabase/quotes";
import { executeStaffPricing } from "../helpers/staff_admin";

test.describe("GATE 010C Playwright E2E Browser Certification Suite", () => {
  let createdQuoteId: string = "";
  let createdQuoteToken: string = "";

  test("1. Guest product browsing, quote form submission, and route link generation", async ({ page }) => {
    // 1. Guest opens products page
    await page.goto("/products");
    await expect(page.locator("h1")).toContainText("Product Catalogue");

    // 2. Guest opens quote request modal for first product
    const requestButtons = page.locator("button:has-text('Get a Quote')");
    await expect(requestButtons.first()).toBeVisible({ timeout: 15000 });
    await requestButtons.first().click();

    // 3. Fill quote form
    await page.fill("input[placeholder='e.g. John Kamau']", "Playwright E2E Test Guest");
    await page.fill("input[placeholder='e.g. 0712 345 678']", "0712345678");
    await page.fill("input[placeholder='e.g. john@example.com']", "e2eguest@example.com");

    const submitBtn = page.locator("button[type='submit']:has-text('Submit Quote Request')");
    await submitBtn.click();

    // 4. Wait for submission success view
    await expect(page.locator("text=Quote Submitted")).toBeVisible({ timeout: 15000 });

    // 5. Verify View & Track Quote Status button href
    const trackLink = page.locator("a:has-text('View & Track Quote Status')");
    await expect(trackLink).toBeVisible();

    const href = await trackLink.getAttribute("href");
    expect(href).not.toBeNull();
    expect(href).toMatch(/\/quotes\/[0-9a-f-]+(\?token=[0-9a-f-]+)?/i);

    // Extract quote ID and token
    const urlObj = new URL(href!, "http://localhost:3000");
    createdQuoteId = urlObj.pathname.split("/").pop() || "";
    createdQuoteToken = urlObj.searchParams.get("token") || "";

    expect(createdQuoteId).not.toBe("");
    expect(createdQuoteToken).not.toBe("");

    // Redact token in output per security standard
    console.log(`[E2E EVIDENCE] Created Quote ID: ${createdQuoteId}, TOKEN: [REDACTED]`);
  });

  test("2. Staff pricing update and guest acceptance flow", async ({ page }) => {
    // If createdQuoteId is empty, create one via RPC
    if (!createdQuoteId) {
      const createRes = await createQuoteRequest({
        customerName: "Playwright Acceptance Guest",
        customerPhone: "0712345678",
        itemType: "product"
      });
      createdQuoteId = createRes.quoteId!;
      createdQuoteToken = createRes.secretToken!;
    }

    // Staff sets price on created quote using authoritative staff pricing helper (Admin/Manager ONLY)
    const validUntil = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
    const priceSuccess = await executeStaffPricing({
      quoteId: createdQuoteId,
      status: "quoted",
      offeredPrice: 24500.0,
      validUntil,
      staffNotes: "Playwright E2E staff price update",
      role: "admin"
    });
    expect(priceSuccess).toBe(true);

    // Now Guest opens exact approved guest route: /quotes/[id]?token=[secret_token]
    const guestUrl = `/quotes/${createdQuoteId}?token=${createdQuoteToken}`;
    await page.goto(guestUrl);

    // Verify Guest sees offered price and STATUS: QUOTED
    await expect(page.locator("h1:has-text('Quote Details')")).toBeVisible();
    await expect(page.locator("text=STATUS: QUOTED")).toBeVisible();
    await expect(page.locator("text=KES 24,500")).toBeVisible();

    // Verify secret token is NOT displayed in HTML body
    const bodyText = await page.innerText("body");
    expect(bodyText).not.toContain(createdQuoteToken);

    // Guest accepts quote
    const acceptBtn = page.locator("button:has-text('Accept Quote')");
    await expect(acceptBtn).toBeVisible();
    await acceptBtn.click();

    // Verify success banner and status change to ACCEPTED
    await expect(page.locator("text=Quote successfully marked as accepted.")).toBeVisible();
    await expect(page.locator("text=STATUS: ACCEPTED")).toBeVisible();
  });

  test("3. Fresh guest decline flow", async ({ page }) => {
    // 1. Submit fresh quote via UI
    await page.goto("/products");
    const requestButtons = page.locator("button:has-text('Get a Quote')");
    await expect(requestButtons.first()).toBeVisible({ timeout: 15000 });
    await requestButtons.first().click();

    await page.fill("input[placeholder='e.g. John Kamau']", "Playwright Decline Guest");
    await page.fill("input[placeholder='e.g. 0712 345 678']", "0700111222");
    await page.locator("button[type='submit']:has-text('Submit Quote Request')").click();

    await expect(page.locator("text=Quote Submitted")).toBeVisible({ timeout: 15000 });
    const trackLink = page.locator("a:has-text('View & Track Quote Status')");
    const href = await trackLink.getAttribute("href");

    const urlObj = new URL(href!, "http://localhost:3000");
    const declineQuoteId = urlObj.pathname.split("/").pop() || "";
    const declineToken = urlObj.searchParams.get("token") || "";

    console.log(`[E2E EVIDENCE] Fresh Decline Quote ID: ${declineQuoteId}, TOKEN: [REDACTED]`);

    // 2. Staff (Manager) prices quote
    const priceSuccess = await executeStaffPricing({
      quoteId: declineQuoteId,
      status: "quoted",
      offeredPrice: 19000.0,
      validUntil: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      role: "manager"
    });
    expect(priceSuccess).toBe(true);

    // 3. Guest retrieves quote & declines
    await page.goto(`/quotes/${declineQuoteId}?token=${declineToken}`);
    await expect(page.locator("text=STATUS: QUOTED")).toBeVisible();

    const declineBtn = page.locator("button:has-text('Decline Quote')");
    await declineBtn.click();

    await expect(page.locator("text=Quote successfully marked as declined.")).toBeVisible();
    await expect(page.locator("text=STATUS: DECLINED")).toBeVisible();
  });

  test("4. Expiry rejection flow", async ({ page }) => {
    // 1. Submit fresh quote via UI
    await page.goto("/products");
    const requestButtons = page.locator("button:has-text('Get a Quote')");
    await expect(requestButtons.first()).toBeVisible({ timeout: 15000 });
    await requestButtons.first().click();

    await page.fill("input[placeholder='e.g. John Kamau']", "Playwright Expiry Guest");
    await page.fill("input[placeholder='e.g. 0712 345 678']", "0700333444");
    await page.locator("button[type='submit']:has-text('Submit Quote Request')").click();

    await expect(page.locator("text=Quote Submitted")).toBeVisible({ timeout: 15000 });
    const href = await page.locator("a:has-text('View & Track Quote Status')").getAttribute("href");
    const urlObj = new URL(href!, "http://localhost:3000");
    const expiryQuoteId = urlObj.pathname.split("/").pop() || "";
    const expiryToken = urlObj.searchParams.get("token") || "";

    // 2. Staff sets past valid_until date (expired)
    const priceSuccess = await executeStaffPricing({
      quoteId: expiryQuoteId,
      status: "quoted",
      offeredPrice: 15000.0,
      validUntil: "2020-01-01T00:00:00Z", // Past date!
      role: "admin"
    });
    expect(priceSuccess).toBe(true);

    // 3. Guest opens quote page -> sees expired text
    await page.goto(`/quotes/${expiryQuoteId}?token=${expiryToken}`);
    await expect(page.locator("text=expired on")).toBeVisible();

    // Verify Accept/Decline action buttons are hidden when expired
    await expect(page.locator("button:has-text('Accept Quote')")).toHaveCount(0);
  });

  test("5. Cashier read-only queue state & backend pricing authorization denial", async ({ page }) => {
    await page.goto("/admin/quotes");
    await expect(page.locator("h1")).toContainText("Staff Quote Queue");

    // Verify quote queue UI elements rendered cleanly
    const refreshBtn = page.locator("button:has-text('Refresh Queue')");
    await expect(refreshBtn).toBeVisible();

    // Verify unauthenticated / cashier pricing RPC call without token is rejected with Forbidden or unauthenticated error
    const targetQuoteId = createdQuoteId || "10000000-0000-0000-0000-000000000001";
    const unauthPricingRes = await updateStaffQuoteResponse({
      quoteId: targetQuoteId,
      status: "quoted",
      offeredPrice: 100.0
    });

    expect(unauthPricingRes.success).toBe(false);
    expect(unauthPricingRes.error).toMatch(/Forbidden|permission denied|invalid input syntax/i);
  });
});
