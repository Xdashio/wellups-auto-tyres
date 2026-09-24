import { test, expect } from "@playwright/test";

test.describe("GATE 033 — V0.6A Customer Quote Portal & Acceptance Certification", () => {
  const testQuoteId = "11111111-2222-3333-4444-555555555555";
  const validToken = "valid-token-1234-5678-abcdef012345";
  const invalidToken = "invalid-token-9999-0000-deadbeef9999";

  test.beforeEach(async ({ page }) => {
    // Intercept RPC get_guest_quote for deterministic testing
    await page.route("**/rest/v1/rpc/get_guest_quote*", async (route) => {
      const payload = route.request().postDataJSON();
      if (payload?.p_token === validToken && payload?.p_quote_id === testQuoteId) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            {
              id: testQuoteId,
              quote_number: "QT-2026-00042",
              customer_name: "Jane Doe",
              customer_phone: "+254711223344",
              customer_email: "jane@example.com",
              item_type: "product",
              product_name: "Bridgestone Dueler A/T 265/65R17",
              service_name: null,
              vehicle_summary: "Toyota Hilux 2020 2.8L",
              quantity: 4,
              customer_notes: "Include fitting and balancing",
              status: "quoted",
              offered_price: 74000.0,
              valid_until: new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString(),
              created_at: new Date(Date.now() - 3600 * 1000).toISOString(),
              updated_at: new Date(Date.now() - 1800 * 1000).toISOString(),
              accepted_at: null,
            },
          ]),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        });
      }
    });

    // Intercept RPC customer_respond_to_quote
    await page.route("**/rest/v1/rpc/customer_respond_to_quote*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(true),
      });
    });
  });

  test("Missing or wrong token displays 'Quote Not Found' empty state", async ({ page }) => {
    // Missing token
    await page.goto(`/quotes/${testQuoteId}`);
    await expect(page.locator("text=Quote Not Found")).toBeVisible({ timeout: 15000 });
    await expect(page.locator("text=invalid or expired")).toBeVisible();

    // Wrong token
    await page.goto(`/quotes/${testQuoteId}?token=${invalidToken}`);
    await expect(page.locator("text=Quote Not Found")).toBeVisible({ timeout: 15000 });
  });

  test("Quoted state displays agreed amount, item details, and validity", async ({ page }) => {
    await page.goto(`/quotes/${testQuoteId}?token=${validToken}`);

    // Header & Info
    await expect(page.locator("h1:has-text('Quote Details')")).toBeVisible({ timeout: 15000 });
    await expect(page.locator("text=QT-2026-00042")).toBeVisible();
    await expect(page.locator("text=STATUS: QUOTED")).toBeVisible();

    // Commercial Quotation Details
    await expect(page.locator("text=Bridgestone Dueler A/T 265/65R17")).toBeVisible();
    await expect(page.locator("text=Quantity: 4")).toBeVisible();
    await expect(page.locator("text=Toyota Hilux 2020 2.8L")).toBeVisible();
    await expect(page.locator("text=KES 74,000")).toBeVisible();
    await expect(page.locator("text=100% Full Payment Required on Acceptance")).toBeVisible();

    // Action buttons visible
    await expect(page.locator("button:has-text('Accept Quote')")).toBeVisible();
    await expect(page.locator("button:has-text('Decline Quote')")).toBeVisible();
  });

  test("Guest accepts quote: portal shows accepted status, frozen amount, and 100% payment notice", async ({
    page,
  }) => {
    await page.goto(`/quotes/${testQuoteId}?token=${validToken}`);

    const acceptBtn = page.locator("button:has-text('Accept Quote')");
    await expect(acceptBtn).toBeVisible({ timeout: 15000 });
    await acceptBtn.click();

    // Success banner
    await expect(page.locator("[data-testid='action-success-banner']")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=Quote successfully marked as accepted.")).toBeVisible();

    // Header updates to ACCEPTED
    await expect(page.locator("text=STATUS: ACCEPTED")).toBeVisible();

    // Accepted Panel
    const acceptedPanel = page.locator("[data-testid='quote-accepted-panel']");
    await expect(acceptedPanel).toBeVisible();
    await expect(acceptedPanel).toContainText("Acceptance Confirmed — Commercial Terms Locked");
    await expect(acceptedPanel).toContainText("KES 74,000");

    // Next step full payment notice
    const paymentPanel = page.locator("[data-testid='next-step-payment-panel']");
    await expect(paymentPanel).toBeVisible();
    await expect(paymentPanel).toContainText("Next Step: Full Payment Required (100%)");
    await expect(paymentPanel).toContainText(
      "No payment has been verified yet. Stock remains in pool until full payment verification"
    );

    // Assert NO payment is falsely shown as verified
    await expect(page.locator("text=Payment Verified")).toHaveCount(0);
  });

  test("Responsive layout verification across all viewports (390, 768, 1024, 1440, 1920)", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    const viewports = [
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
      { width: 1024, height: 768 },
      { width: 1440, height: 900 },
      { width: 1920, height: 1080 },
    ];

    for (const vp of viewports) {
      await page.setViewportSize(vp);
      await page.goto(`/quotes/${testQuoteId}?token=${validToken}`);
      await expect(page.locator("h1:has-text('Quote Details')")).toBeVisible({ timeout: 15000 });

      // Check document overflow
      const hasHorizontalOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
      });
      expect(
        hasHorizontalOverflow,
        `Detected horizontal overflow at viewport width ${vp.width}px`
      ).toBe(false);
    }

    // Filter out sandbox network fetch warnings (if any) and assert zero code console errors
    const applicationErrors = consoleErrors.filter(
      (err) => !err.includes("Failed to load resource") && !err.includes("TypeError: fetch failed")
    );
    expect(applicationErrors).toHaveLength(0);
  });
});
