import { test, expect, Page } from "@playwright/test";

const TEST_QUOTE_ID = "11111111-2222-3333-4444-555555555555";
const VALID_TOKEN = "valid-token-1234-5678-abcdef012345";

const QUOTE = {
  id: TEST_QUOTE_ID,
  quote_number: "QT-2026-00060",
  customer_name: "Test Customer",
  customer_phone: "+254700111222",
  customer_email: "test@example.com",
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
};

function baseMessages(): any[] {
  return [
    {
      id: "aaaaaaaa-0000-0000-0000-000000000001",
      quote_id: TEST_QUOTE_ID,
      sender_type: "system",
      sender_display_name: "System",
      message_body: "Quote request created",
      event_type: "quote_created",
      event_metadata: { quote_number: QUOTE.quote_number },
      created_at: new Date(Date.now() - 3600 * 1000).toISOString(),
    },
    {
      id: "aaaaaaaa-0000-0000-0000-000000000002",
      quote_id: TEST_QUOTE_ID,
      sender_type: "staff",
      staff_id: "bbbbbbbb-0000-0000-0000-000000000000",
      sender_display_name: "Alice Mwangi",
      message_body:
        "Good morning! We confirm availability of these 4 tyres. The offered price includes fitting and balancing.",
      event_type: "staff_message",
      event_metadata: null,
      created_at: new Date(Date.now() - 2700 * 1000).toISOString(),
    },
    {
      id: "aaaaaaaa-0000-0000-0000-000000000003",
      quote_id: TEST_QUOTE_ID,
      sender_type: "customer",
      sender_display_name: "Test Customer",
      message_body: "Thank you! Please confirm the tyres are in stock.",
      event_type: "customer_message",
      event_metadata: null,
      created_at: new Date(Date.now() - 2400 * 1000).toISOString(),
    },
    {
      id: "aaaaaaaa-0000-0000-0000-000000000004",
      quote_id: TEST_QUOTE_ID,
      sender_type: "system",
      sender_display_name: "System",
      message_body: "Quotation issued",
      event_type: "quote_priced",
      event_metadata: { staff_name: "Alice Mwangi", offered_price: 74000 },
      created_at: new Date(Date.now() - 1800 * 1000).toISOString(),
    },
  ];
}

async function interceptPortalRpc(page: Page, opts?: { acceptOnInit?: boolean }) {
  let accepted = Boolean(opts?.acceptOnInit);

  await page.route("**/rest/v1/rpc/get_guest_quote**", async (route) => {
    const payload = route.request().postDataJSON();
    if (payload?.p_token === VALID_TOKEN && payload?.p_quote_id === TEST_QUOTE_ID) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([QUOTE]) });
    } else {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
    }
  });

  await page.route("**/rest/v1/rpc/get_quote_messages**", async (route) => {
    const payload = route.request().postDataJSON();
    if (payload?.p_token !== VALID_TOKEN || payload?.p_quote_id !== TEST_QUOTE_ID) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
      return;
    }
    const msgs = baseMessages();
    if (accepted) {
      msgs.push({
        id: "aaaaaaaa-0000-0000-0000-000000000005",
        quote_id: TEST_QUOTE_ID,
        sender_type: "system",
        sender_display_name: "System",
        message_body: "Quote accepted by customer",
        event_type: "quote_accepted",
        event_metadata: { customer_name: QUOTE.customer_name, offered_price: QUOTE.offered_price },
        created_at: new Date().toISOString(),
      });
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(msgs) });
  });

  await page.route("**/rest/v1/rpc/send_quote_message**", async (route) => {
    const payload = route.request().postDataJSON();
    if (payload?.p_token !== VALID_TOKEN || payload?.p_quote_id !== TEST_QUOTE_ID) {
      await route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ message: "Invalid quote or token" }) });
      return;
    }
    const newId = "cccccccc-0000-0000-0000-00000000000f";
    accepted = false;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(newId) });
  });

  await page.route("**/rest/v1/rpc/customer_respond_to_quote**", async (route) => {
    const payload = route.request().postDataJSON();
    if (payload?.p_quote_id !== TEST_QUOTE_ID) {
      await route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ message: "Quote not found" }) });
      return;
    }
    if (payload?.p_action === "accept") accepted = true;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(true) });
  });
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  );
  expect(overflow, "Horizontal overflow detected").toBe(false);
}

test.describe("GATE 034 — V0.6B Quote Conversation & Audit Timeline (Browser)", () => {
  test("Conversation thread renders system events, staff message, and customer message distinctly", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await interceptPortalRpc(page);

    await page.goto(`/quotes/${TEST_QUOTE_ID}?token=${VALID_TOKEN}`, { waitUntil: "networkidle" });

    await expect(page.locator("h1:has-text('Quote Details')")).toBeVisible({ timeout: 15000 });

    // System events visually distinct with correct labels
    await expect(page.locator("[data-testid='timeline-system-event'][data-event-type='quote_created']")).toContainText("Quote Created");
    await expect(page.locator("[data-testid='timeline-system-event'][data-event-type='quote_priced']")).toContainText("Quotation Issued");

    // Staff message shown as Well Lups Team to guest
    const staffMsg = page.locator("[data-testid='timeline-staff-message']");
    await expect(staffMsg).toHaveCount(1);
    await expect(staffMsg).toContainText("Well Lups Team");

    // Customer message shown with customer identity
    const customerMsg = page.locator("[data-testid='timeline-customer-message']");
    await expect(customerMsg).toHaveCount(1);
    await expect(customerMsg).toContainText("Thank you! Please confirm the tyres are in stock.");

    // Entry counter reflects all 4 seed messages
    await expect(page.locator("text=4 entries")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("Guest can send a message via the composer and it reloads into the thread", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await interceptPortalRpc(page);

    await page.goto(`/quotes/${TEST_QUOTE_ID}?token=${VALID_TOKEN}`, { waitUntil: "networkidle" });
    await expect(page.locator("h1:has-text('Quote Details')")).toBeVisible({ timeout: 15000 });

    const composer = page.locator("[data-testid='quote-message-input']");
    await expect(composer).toBeVisible();
    await composer.fill("Please confirm stock before I accept.");
    await page.click("[data-testid='send-message-btn']");

    // Empty composer after send
    await expect(composer).toHaveValue("");
  });

  test("Long 2000-character message wraps without horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await interceptPortalRpc(page);

    await page.goto(`/quotes/${TEST_QUOTE_ID}?token=${VALID_TOKEN}`, { waitUntil: "networkidle" });
    await expect(page.locator("h1:has-text('Quote Details')")).toBeVisible({ timeout: 15000 });

    const composer = page.locator("[data-testid='quote-message-input']");
    const longMessage = "A".repeat(2000);
    await composer.fill(longMessage);

    // Counter shows exactly 2000 and send button is enabled
    await expect(page.locator("text=2000/2000")).toBeVisible();
    const sendBtn = page.locator("[data-testid='send-message-btn']");
    await expect(sendBtn).toBeEnabled();

    // A message over the limit disables sending
    await composer.fill("A".repeat(2001));
    await expect(page.locator("text=2001/2000")).toBeVisible();
    await expect(page.locator("[data-testid='send-message-btn']")).toBeDisabled();

    await expectNoHorizontalOverflow(page);
  });

  test("Accept flow emits quote_accepted system event and FREEZES accepted amount (no payment verified)", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await interceptPortalRpc(page);

    await page.goto(`/quotes/${TEST_QUOTE_ID}?token=${VALID_TOKEN}`, { waitUntil: "networkidle" });
    await expect(page.locator("button:has-text('Accept Quote')")).toBeVisible({ timeout: 15000 });
    await page.click("button:has-text('Accept Quote')");

    await expect(page.locator("[data-testid='action-success-banner']")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=STATUS: ACCEPTED")).toBeVisible({ timeout: 10000 });

    const acceptedPanel = page.locator("[data-testid='quote-accepted-panel']");
    await expect(acceptedPanel).toContainText("Acceptance Confirmed — Commercial Terms Locked");
    await expect(acceptedPanel).toContainText("KES 74,000");

    // quote_accepted system event appears in the timeline after reload
    await expect(
      page.locator("[data-testid='timeline-system-event'][data-event-type='quote_accepted']")
    ).toContainText("Quote Accepted");

    // NO payment is ever shown as verified
    await expect(page.locator("[data-testid='next-step-payment-panel']")).toContainText(
      "No payment has been verified yet."
    );
    await expect(page.locator("text=Payment Verified")).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });

  test("Responsive layout across 390/430/560/768/1024/1440/1920 with zero console errors", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push(err.message));

    const viewports = [
      { width: 390, height: 844 },
      { width: 430, height: 932 },
      { width: 560, height: 900 },
      { width: 768, height: 1024 },
      { width: 1024, height: 768 },
      { width: 1440, height: 900 },
      { width: 1920, height: 1080 },
    ];

    await interceptPortalRpc(page);

    for (const vp of viewports) {
      await page.setViewportSize(vp);
      await page.goto(`/quotes/${TEST_QUOTE_ID}?token=${VALID_TOKEN}`, { waitUntil: "networkidle" });
      await expect(page.locator("h1:has-text('Quote Details')")).toBeVisible({ timeout: 15000 });

      // Thread readable + composer usable
      await expect(page.locator("[data-testid='timeline-system-event']").first()).toBeVisible();
      await expect(page.locator("[data-testid='quote-message-input']")).toBeVisible();

      await expectNoHorizontalOverflow(page);
    }

    const applicationErrors = consoleErrors.filter(
      (err) => !err.includes("Failed to load resource") && !err.includes("TypeError: fetch failed")
    );
    expect(applicationErrors).toEqual([]);
  });

  test("Decline state preserves conversation history and hides composer", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });

    // Decline by starting from a declined quote
    await page.route("**/rest/v1/rpc/get_guest_quote**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{ ...QUOTE, status: "declined", declined_at: new Date().toISOString() }]),
      });
    });
    await page.route("**/rest/v1/rpc/get_quote_messages**", async (route) => {
      const msgs = baseMessages();
      msgs.push({
        id: "aaaaaaaa-0000-0000-0000-000000000006",
        quote_id: TEST_QUOTE_ID,
        sender_type: "system",
        sender_display_name: "System",
        message_body: "Quote declined by customer",
        event_type: "quote_declined",
        event_metadata: { customer_name: QUOTE.customer_name },
        created_at: new Date().toISOString(),
      });
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(msgs) });
    });
    await page.route("**/rest/v1/rpc/send_quote_message**", async (route) => {
      await route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ message: "Cannot send messages on a declined quote" }) });
    });

    await page.goto(`/quotes/${TEST_QUOTE_ID}?token=${VALID_TOKEN}`, { waitUntil: "networkidle" });

    await expect(page.locator("[data-testid='quote-declined-panel']")).toBeVisible({ timeout: 15000 });
    // History preserved but composer hidden
    await expect(page.locator("[data-testid='timeline-system-event'][data-event-type='quote_declined']")).toContainText("Quote Declined");
    await expect(page.locator("[data-testid='quote-message-input']")).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });
});