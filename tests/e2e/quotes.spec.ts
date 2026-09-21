import { test, expect, Page } from "@playwright/test";
import { getGuestQuote, updateCustomerQuoteStatus } from "@/lib/supabase/quotes";

async function authenticateStaff(page: Page, role: "admin" | "manager" | "cashier") {
  await page.goto("/admin/quotes");
  await page.waitForSelector("[data-testid='staff-session-bar'], [data-testid='staff-auth-panel']", { timeout: 15000 });

  const currentRoleBadge = page.locator("[data-testid='staff-role']");
  if (await currentRoleBadge.isVisible()) {
    const text = await currentRoleBadge.innerText();
    if (text.includes(role.toUpperCase())) {
      return;
    }
    await page.locator("[data-testid='staff-signout-btn']").click();
    await page.waitForSelector("[data-testid='staff-auth-panel']", { timeout: 10000 });
  }

  await page.locator(`[data-testid='login-${role}-quick']`).click();
  await expect(page.locator("[data-testid='staff-session-bar']")).toBeVisible({ timeout: 10000 });
  await expect(page.locator("[data-testid='staff-role']")).toContainText(role.toUpperCase());
}

test.describe("GATE 010C Playwright E2E Browser Certification Suite", () => {
  // =========================================================================
  // TEST A — ACCEPTANCE
  // =========================================================================
  test("TEST A — ACCEPTANCE: Guest submit -> Staff authenticate -> Queue -> new -> under_review -> price & quoted -> Guest accept -> DB accepted", async ({ page }) => {
    // 1. Guest opens product
    await page.goto("/products");
    await expect(page.locator("h1")).toContainText("Product Catalogue");
    const requestButtons = page.locator("button:has-text('Get a Quote')");
    await expect(requestButtons.first()).toBeVisible({ timeout: 15000 });
    await requestButtons.first().click();

    // 2. Guest submits quote
    await page.fill("input[placeholder='e.g. John Kamau']", "Playwright E2E Guest A");
    await page.fill("input[placeholder='e.g. 0712 345 678']", "0711223344");
    await page.fill("input[placeholder='e.g. john@example.com']", "guestA@example.com");

    const submitBtn = page.locator("button[type='submit']:has-text('Submit Quote Request')");
    await submitBtn.click();
    await expect(page.locator("text=Quote Submitted")).toBeVisible({ timeout: 15000 });

    const trackLink = page.locator("a:has-text('View & Track Quote Status')");
    await expect(trackLink).toBeVisible();
    const href = await trackLink.getAttribute("href");
    const urlObj = new URL(href!, "http://localhost:3000");
    const quoteId = urlObj.pathname.split("/").pop() || "";
    const secretToken = urlObj.searchParams.get("token") || "";

    expect(quoteId).not.toBe("");
    expect(secretToken).not.toBe("");
    console.log(`[E2E EVIDENCE] TEST A Quote ID: ${quoteId}, TOKEN: [REDACTED]`);

    // 3. Admin or Manager authenticates
    await authenticateStaff(page, "admin");

    // 4. Staff opens quote queue
    await expect(page.locator("h1")).toContainText("Staff Quote Queue");

    // 5. Staff opens quote
    const manageBtn = page.locator(`[data-testid='manage-quote-btn'][data-quote-id='${quoteId}']`);
    await expect(manageBtn).toBeVisible({ timeout: 15000 });
    await manageBtn.click();

    // 6. Staff moves new -> under_review
    await expect(page.locator("h2:has-text('Quote Response')")).toBeVisible();
    const statusSelect = page.locator("[data-testid='quote-status-select']");
    await expect(statusSelect).toHaveValue("under_review");
    const saveBtn = page.locator("[data-testid='save-quote-response-btn']");
    await expect(saveBtn).toContainText("Move to Under Review");
    await saveBtn.click();
    await expect(page.locator("h2:has-text('Quote Response')")).not.toBeVisible({ timeout: 15000 });

    // 7. Staff prices quote & 8. Staff moves under_review -> quoted
    const reviewManageBtn = page.locator(`[data-testid='manage-quote-btn'][data-quote-id='${quoteId}'][data-quote-status='under_review']`);
    await expect(reviewManageBtn).toBeVisible({ timeout: 15000 });
    await reviewManageBtn.click();

    await expect(page.locator("h2:has-text('Quote Response')")).toBeVisible();
    await expect(statusSelect).toHaveValue("quoted");
    await page.fill("[data-testid='quote-offered-price-input']", "25000");
    await saveBtn.click();
    await expect(page.locator("h2:has-text('Quote Response')")).not.toBeVisible({ timeout: 15000 });

    // 9. Guest opens /quotes/[id]?token=[secret_token]
    await page.goto(`/quotes/${quoteId}?token=${secretToken}`);

    // 10. Guest sees offered price
    await expect(page.locator("h1:has-text('Quote Details')")).toBeVisible();
    await expect(page.locator("text=STATUS: QUOTED")).toBeVisible();
    await expect(page.locator("text=KES 25,000")).toBeVisible();

    // 11. Guest accepts
    const acceptBtn = page.locator("button:has-text('Accept Quote')");
    await expect(acceptBtn).toBeVisible();
    await acceptBtn.click();

    // 12. Verify UI success
    await expect(page.locator("text=Quote successfully marked as accepted.")).toBeVisible({ timeout: 15000 });
    await expect(page.locator("text=STATUS: ACCEPTED")).toBeVisible({ timeout: 15000 });

    // 13. Verify final DB status = accepted
    const verifyRes = await getGuestQuote(quoteId, secretToken);
    expect(verifyRes).not.toBeNull();
    expect(verifyRes?.status).toBe("accepted");
  });

  // =========================================================================
  // TEST B — DECLINE
  // =========================================================================
  test("TEST B — DECLINE: Fresh disposable quote -> staff under_review -> staff quoted -> guest retrieve -> guest decline -> DB declined", async ({ page }) => {
    // 1. Guest creates fresh quote
    await page.goto("/products");
    const requestButtons = page.locator("button:has-text('Get a Quote')");
    await expect(requestButtons.first()).toBeVisible({ timeout: 15000 });
    await requestButtons.first().click();

    await page.fill("input[placeholder='e.g. John Kamau']", "Playwright E2E Guest B");
    await page.fill("input[placeholder='e.g. 0712 345 678']", "0722334455");
    await page.locator("button[type='submit']:has-text('Submit Quote Request')").click();
    await expect(page.locator("text=Quote Submitted")).toBeVisible({ timeout: 15000 });

    const trackLink = page.locator("a:has-text('View & Track Quote Status')");
    const href = await trackLink.getAttribute("href");
    const urlObj = new URL(href!, "http://localhost:3000");
    const quoteId = urlObj.pathname.split("/").pop() || "";
    const secretToken = urlObj.searchParams.get("token") || "";

    console.log(`[E2E EVIDENCE] TEST B Quote ID: ${quoteId}, TOKEN: [REDACTED]`);

    // 2. Staff under_review -> staff quoted
    await authenticateStaff(page, "manager");

    // Move new -> under_review
    const manageBtn = page.locator(`[data-testid='manage-quote-btn'][data-quote-id='${quoteId}']`);
    await expect(manageBtn).toBeVisible({ timeout: 15000 });
    await manageBtn.click();
    await page.locator("[data-testid='save-quote-response-btn']").click();
    await expect(page.locator("h2:has-text('Quote Response')")).not.toBeVisible({ timeout: 15000 });

    // Move under_review -> quoted
    const reviewManageBtn = page.locator(`[data-testid='manage-quote-btn'][data-quote-id='${quoteId}'][data-quote-status='under_review']`);
    await expect(reviewManageBtn).toBeVisible({ timeout: 15000 });
    await reviewManageBtn.click();
    await page.fill("[data-testid='quote-offered-price-input']", "18000");
    await page.locator("[data-testid='save-quote-response-btn']").click();
    await expect(page.locator("h2:has-text('Quote Response')")).not.toBeVisible({ timeout: 15000 });

    // 3. Guest retrieve
    await page.goto(`/quotes/${quoteId}?token=${secretToken}`);
    await expect(page.locator("text=STATUS: QUOTED")).toBeVisible();
    await expect(page.locator("text=KES 18,000")).toBeVisible();

    // 4. Guest decline
    const declineBtn = page.locator("button:has-text('Decline Quote')");
    await expect(declineBtn).toBeVisible();
    await declineBtn.click();

    // 5. Verify UI success
    await expect(page.locator("text=Quote successfully marked as declined.")).toBeVisible({ timeout: 15000 });
    await expect(page.locator("text=STATUS: DECLINED")).toBeVisible({ timeout: 15000 });

    // 6. Verify DB status declined
    const verifyRes = await getGuestQuote(quoteId, secretToken);
    expect(verifyRes?.status).toBe("declined");
  });

  // =========================================================================
  // TEST C — EXPIRY
  // =========================================================================
  test("TEST C — EXPIRY: Fresh disposable quote -> staff under_review -> staff quoted expired -> guest retrieve -> acceptance unavailable -> DB expired", async ({ page }) => {
    // 1. Guest creates fresh quote
    await page.goto("/products");
    const requestButtons = page.locator("button:has-text('Get a Quote')");
    await expect(requestButtons.first()).toBeVisible({ timeout: 15000 });
    await requestButtons.first().click();

    await page.fill("input[placeholder='e.g. John Kamau']", "Playwright E2E Guest C");
    await page.fill("input[placeholder='e.g. 0712 345 678']", "0733445566");
    await page.locator("button[type='submit']:has-text('Submit Quote Request')").click();
    await expect(page.locator("text=Quote Submitted")).toBeVisible({ timeout: 15000 });

    const trackLink = page.locator("a:has-text('View & Track Quote Status')");
    const href = await trackLink.getAttribute("href");
    const urlObj = new URL(href!, "http://localhost:3000");
    const quoteId = urlObj.pathname.split("/").pop() || "";
    const secretToken = urlObj.searchParams.get("token") || "";

    console.log(`[E2E EVIDENCE] TEST C Quote ID: ${quoteId}, TOKEN: [REDACTED]`);

    // 2. Staff under_review -> staff quoted with expired valid_until
    await authenticateStaff(page, "admin");

    // Move new -> under_review
    const manageBtn = page.locator(`[data-testid='manage-quote-btn'][data-quote-id='${quoteId}']`);
    await expect(manageBtn).toBeVisible({ timeout: 15000 });
    await manageBtn.click();
    await page.locator("[data-testid='save-quote-response-btn']").click();
    await expect(page.locator("h2:has-text('Quote Response')")).not.toBeVisible({ timeout: 15000 });

    // Move under_review -> quoted with past date
    const reviewManageBtn = page.locator(`[data-testid='manage-quote-btn'][data-quote-id='${quoteId}'][data-quote-status='under_review']`);
    await expect(reviewManageBtn).toBeVisible({ timeout: 15000 });
    await reviewManageBtn.click();
    await page.fill("[data-testid='quote-offered-price-input']", "15000");
    await page.fill("[data-testid='quote-valid-until-input']", "2020-01-01");
    await page.locator("[data-testid='save-quote-response-btn']").click();
    await expect(page.locator("h2:has-text('Quote Response')")).not.toBeVisible({ timeout: 15000 });

    // 3. Guest opens quote
    await page.goto(`/quotes/${quoteId}?token=${secretToken}`);

    // 4. Guest sees expired state and acceptance is unavailable
    await expect(page.locator("text=expired on")).toBeVisible();
    await expect(page.locator("text=STATUS: EXPIRED")).toBeVisible();
    await expect(page.locator("button:has-text('Accept Quote')")).toHaveCount(0);

    // 5. Verify DB expiry behavior via direct customer response attempt rejection
    const updateRes = await updateCustomerQuoteStatus(quoteId, "accepted", secretToken);
    expect(updateRes.success).toBe(false);
    expect(updateRes.error).toContain("Quote has expired and can no longer be accepted");

    const verifyRes = await getGuestQuote(quoteId, secretToken);
    expect(verifyRes?.status).toBe("expired");
  });

  // =========================================================================
  // TEST D — CASHIER
  // =========================================================================
  test("TEST D — CASHIER: Authenticate as Cashier -> open /admin/quotes -> queue readable -> pricing controls absent/disabled -> backend pricing rejected", async ({ page }) => {
    // 1. Authenticate as Cashier
    await authenticateStaff(page, "cashier");

    // 2. Open /admin/quotes
    await expect(page.locator("h1")).toContainText("Staff Quote Queue");

    // 3. Verify queue is readable
    const firstManageBtn = page.locator("[data-testid='manage-quote-btn']").first();
    await expect(firstManageBtn).toBeVisible({ timeout: 15000 });

    // 4. Verify pricing controls are absent/disabled
    await firstManageBtn.click();
    await expect(page.locator("[data-testid='cashier-readonly-notice']")).toBeVisible();
    await expect(page.locator("[data-testid='quote-offered-price-input']")).toBeDisabled();
    await expect(page.locator("[data-testid='quote-valid-until-input']")).toBeDisabled();
    await expect(page.locator("[data-testid='quote-status-select']")).toBeDisabled();
    await expect(page.locator("[data-testid='save-quote-response-btn']")).toBeDisabled();

    // 5. Attempt underlying staff pricing action
    const cashierPricingRes = await page.evaluate(async () => {
      const client = (window as any).__supabase;
      const res = await client.rpc("staff_respond_to_quote", {
        p_quote_id: "00000000-0000-0000-0000-000000000000",
        p_status: "quoted",
        p_offered_price: 100
      });
      return { error: res.error ? res.error.message : null };
    });

    // 6. Verify backend rejects it
    expect(cashierPricingRes.error).not.toBeNull();
    expect(cashierPricingRes.error).toMatch(/Forbidden: Only Admin and Manager roles are authorized to manage quote pricing/i);
  });
});
