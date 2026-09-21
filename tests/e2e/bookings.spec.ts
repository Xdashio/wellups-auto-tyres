import { test, expect, Page } from "@playwright/test";
import { getGuestBooking } from "@/lib/supabase/bookings";

async function authenticateStaff(page: Page, role: "admin" | "manager" | "cashier") {
  await page.goto("/admin/bookings");
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

test.describe("v0.4 Service Booking Playwright E2E Browser Certification Suite", () => {
  // =========================================================================
  // TEST A — FULL LIFECYCLE (ACCEPTANCE)
  // =========================================================================
  test("TEST A — FULL LIFECYCLE: Guest submit -> Admin triage (new -> under_review) -> Admin schedule (under_review -> scheduled) -> Guest verify scheduled -> Cashier complete (scheduled -> completed) -> Guest verify completed", async ({
    page,
  }) => {
    // 1. Guest opens services catalogue and navigates to service detail
    await page.goto("/services");
    await expect(page.locator("h1")).toContainText("Garage Services");
    const viewDetailButtons = page.locator("a:has-text('View Details')");
    await expect(viewDetailButtons.first()).toBeVisible({ timeout: 15000 });
    await viewDetailButtons.first().click();

    // 2. Guest clicks "Book Service" button
    const bookBtn = page.locator("[data-testid='book-service-btn']");
    await expect(bookBtn).toBeVisible({ timeout: 10000 });
    await bookBtn.click();

    // 3. Verify exact mandatory booking clarification notice
    const clarification = page.locator("[data-testid='booking-clarification-notice']");
    await expect(clarification).toBeVisible();
    await expect(clarification).toContainText(
      "Submitting this request sends your preferred date and time to our workshop team. Your appointment is not confirmed until our team reviews the request and schedules it."
    );

    // 4. Fill customer booking form
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 3);
    const dateStr = tomorrow.toISOString().slice(0, 10);

    await page.fill("[data-testid='booking-name-input']", "Playwright E2E Customer A");
    await page.fill("[data-testid='booking-phone-input']", "0711002233");
    await page.fill("[data-testid='booking-email-input']", "customerA@example.com");
    await page.fill("[data-testid='booking-date-input']", dateStr);
    await page.fill("[data-testid='booking-time-input']", "11:30");
    await page.fill("[data-testid='booking-vehicle-input']", "Toyota Hilux KCC 789D");
    await page.fill("[data-testid='booking-notes-input']", "Brake pad replacement and alignment check");

    // 5. Submit booking request
    await page.locator("[data-testid='submit-booking-btn']").click();
    await expect(page.locator("text=Booking Request Submitted")).toBeVisible({ timeout: 15000 });

    // 6. Extract booking ID and secret token from tracking link
    const trackLink = page.locator("[data-testid='track-booking-link']");
    await expect(trackLink).toBeVisible();
    const href = await trackLink.getAttribute("href");
    const urlObj = new URL(href!, "http://localhost:3000");
    const bookingId = urlObj.pathname.split("/").pop() || "";
    const secretToken = urlObj.searchParams.get("token") || "";

    expect(bookingId).not.toBe("");
    expect(secretToken).not.toBe("");
    console.log(`[E2E EVIDENCE] TEST A Booking ID: ${bookingId}, TOKEN: [REDACTED]`);

    // 7. Admin authenticates and opens booking queue
    await authenticateStaff(page, "admin");
    await expect(page.locator("h1")).toContainText("Staff Service Booking Queue");

    // 8. Admin locates booking in queue
    const manageBtn = page.locator(`[data-testid='manage-booking-btn'][data-booking-id='${bookingId}']`);
    await expect(manageBtn).toBeVisible({ timeout: 15000 });
    await manageBtn.click();

    // 9. Admin moves new -> under_review
    await expect(page.locator("[data-testid='booking-action-dialog']")).toBeVisible();
    const moveReviewBtn = page.locator("[data-testid='move-under-review-btn']");
    await expect(moveReviewBtn).toBeVisible();
    await moveReviewBtn.click();
    await expect(page.locator("[data-testid='booking-action-dialog']")).not.toBeVisible({ timeout: 15000 });

    // 10. Admin reopens modal and moves under_review -> scheduled
    const reviewManageBtn = page.locator(`[data-testid='manage-booking-btn'][data-booking-id='${bookingId}']`);
    await expect(reviewManageBtn).toBeVisible({ timeout: 15000 });
    await reviewManageBtn.click();

    await expect(page.locator("[data-testid='booking-action-dialog']")).toBeVisible();
    const scheduledInput = page.locator("[data-testid='booking-scheduled-at-input']");
    await expect(scheduledInput).toBeVisible();

    // Confirm future appointment time
    const schedDate = new Date();
    schedDate.setDate(schedDate.getDate() + 3);
    schedDate.setHours(14, 0, 0, 0);
    const schedStr = schedDate.toISOString().slice(0, 16);
    await page.fill("[data-testid='booking-scheduled-at-input']", schedStr);
    await page.fill("[data-testid='booking-staff-notes-input']", "Assigned Bay 3 to Senior Tech David");

    const scheduleBtn = page.locator("[data-testid='confirm-schedule-btn']");
    await scheduleBtn.click();
    await expect(page.locator("[data-testid='booking-action-dialog']")).not.toBeVisible({ timeout: 15000 });

    // 11. Guest opens tracking page /bookings/[id]?token=...
    await page.goto(`/bookings/${bookingId}?token=${secretToken}`);
    await expect(page.locator("[data-testid='booking-detail-view']")).toBeVisible({ timeout: 15000 });
    await expect(page.locator("[data-testid='booking-status-badge']")).toContainText("SCHEDULED");
    await expect(page.locator("[data-testid='confirmed-appointment-banner']")).toBeVisible();

    // 12. Cashier authenticates and opens booking queue
    await authenticateStaff(page, "cashier");

    // 13. Cashier opens scheduled booking and marks completed
    const cashierManageBtn = page.locator(`[data-testid='manage-booking-btn'][data-booking-id='${bookingId}']`);
    await expect(cashierManageBtn).toBeVisible({ timeout: 15000 });
    await cashierManageBtn.click();

    const markCompletedBtn = page.locator("[data-testid='mark-completed-btn']");
    await expect(markCompletedBtn).toBeVisible();
    await markCompletedBtn.click();
    await expect(page.locator("[data-testid='booking-action-dialog']")).not.toBeVisible({ timeout: 15000 });

    // 14. Guest reloads tracking page and confirms COMPLETED status
    await page.goto(`/bookings/${bookingId}?token=${secretToken}`);
    await expect(page.locator("[data-testid='booking-status-badge']")).toContainText("COMPLETED");

    // 15. Verify final DB status
    const verifyBooking = await getGuestBooking(bookingId, secretToken);
    expect(verifyBooking).not.toBeNull();
    expect(verifyBooking?.status).toBe("completed");
  });

  // =========================================================================
  // TEST B — DECLINE WORKFLOW
  // =========================================================================
  test("TEST B — DECLINE: Guest submit -> Manager open queue -> Manager new -> declined -> Guest tracker shows DECLINED", async ({
    page,
  }) => {
    // 1. Guest creates fresh booking request
    await page.goto("/services");
    const viewDetailButtons = page.locator("a:has-text('View Details')");
    await expect(viewDetailButtons.first()).toBeVisible({ timeout: 15000 });
    await viewDetailButtons.first().click();

    await page.locator("[data-testid='book-service-btn']").click();

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 2);
    const dateStr = tomorrow.toISOString().slice(0, 10);

    await page.fill("[data-testid='booking-name-input']", "Playwright E2E Guest B");
    await page.fill("[data-testid='booking-phone-input']", "0722334455");
    await page.fill("[data-testid='booking-date-input']", dateStr);
    await page.fill("[data-testid='booking-time-input']", "15:00");
    await page.locator("[data-testid='submit-booking-btn']").click();

    await expect(page.locator("text=Booking Request Submitted")).toBeVisible({ timeout: 15000 });

    const trackLink = page.locator("[data-testid='track-booking-link']");
    const href = await trackLink.getAttribute("href");
    const urlObj = new URL(href!, "http://localhost:3000");
    const bookingId = urlObj.pathname.split("/").pop() || "";
    const secretToken = urlObj.searchParams.get("token") || "";

    console.log(`[E2E EVIDENCE] TEST B Booking ID: ${bookingId}, TOKEN: [REDACTED]`);

    // 2. Manager authenticates and opens booking queue
    await authenticateStaff(page, "manager");

    const manageBtn = page.locator(`[data-testid='manage-booking-btn'][data-booking-id='${bookingId}']`);
    await expect(manageBtn).toBeVisible({ timeout: 15000 });
    await manageBtn.click();

    // 3. Manager declines request
    const declineBtn = page.locator("[data-testid='decline-booking-btn']");
    await expect(declineBtn).toBeVisible();
    await declineBtn.click();
    await expect(page.locator("[data-testid='booking-action-dialog']")).not.toBeVisible({ timeout: 15000 });

    // 4. Guest tracker confirms status is DECLINED
    await page.goto(`/bookings/${bookingId}?token=${secretToken}`);
    await expect(page.locator("[data-testid='booking-status-badge']")).toContainText("DECLINED");
    await expect(page.locator("text=Booking Request Declined")).toBeVisible();

    // 5. Verify database status
    const verifyBooking = await getGuestBooking(bookingId, secretToken);
    expect(verifyBooking?.status).toBe("declined");
  });

  // =========================================================================
  // TEST C — CASHIER RBAC GUARD
  // =========================================================================
  test("TEST C — CASHIER RBAC: Cashier logs in -> inspects new/under_review booking -> controls disabled -> direct forbidden RPC rejected with 403", async ({
    page,
  }) => {
    // 1. Guest creates fresh booking request (guaranteed 'new' status)
    await page.goto("/services");
    const viewDetailButtons = page.locator("a:has-text('View Details')");
    await expect(viewDetailButtons.first()).toBeVisible({ timeout: 15000 });
    await viewDetailButtons.first().click();

    await page.locator("[data-testid='book-service-btn']").click();

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 4);
    const dateStr = tomorrow.toISOString().slice(0, 10);

    await page.fill("[data-testid='booking-name-input']", "Playwright E2E Guest C");
    await page.fill("[data-testid='booking-phone-input']", "0733445566");
    await page.fill("[data-testid='booking-date-input']", dateStr);
    await page.fill("[data-testid='booking-time-input']", "09:30");
    await page.locator("[data-testid='submit-booking-btn']").click();

    await expect(page.locator("text=Booking Request Submitted")).toBeVisible({ timeout: 15000 });

    const trackLink = page.locator("[data-testid='track-booking-link']");
    const href = await trackLink.getAttribute("href");
    const urlObj = new URL(href!, "http://localhost:3000");
    const bookingId = urlObj.pathname.split("/").pop() || "";
    const secretToken = urlObj.searchParams.get("token") || "";

    expect(bookingId).not.toBe("");
    expect(secretToken).not.toBe("");
    console.log(`[E2E EVIDENCE] TEST C Booking ID: ${bookingId}, TOKEN: [REDACTED]`);

    // 2. Authenticate as Cashier
    await authenticateStaff(page, "cashier");

    // 3. Locate and open the fresh booking (status is 'new')
    const manageBtn = page.locator(`[data-testid='manage-booking-btn'][data-booking-id='${bookingId}']`);
    await expect(manageBtn).toBeVisible({ timeout: 15000 });
    await manageBtn.click();

    // 4. Verify Cashier readonly notice is visible and action buttons are absent
    await expect(page.locator("[data-testid='cashier-readonly-notice']")).toBeVisible();
    await expect(page.locator("[data-testid='move-under-review-btn']")).toHaveCount(0);
    await expect(page.locator("[data-testid='confirm-schedule-btn']")).toHaveCount(0);
    await expect(page.locator("[data-testid='decline-booking-btn']")).toHaveCount(0);
    await expect(page.locator("[data-testid='mark-completed-btn']")).toHaveCount(0);

    // 5. Attempt direct backend RPC call from Cashier browser session
    const cashierForbiddenRes = await page.evaluate(async (bId) => {
      const client = (window as any).__supabase;
      const res = await client.rpc("staff_manage_booking", {
        p_booking_id: bId,
        p_status: "under_review",
      });
      return { error: res.error ? res.error.message : null };
    }, bookingId);

    // 6. Verify backend strictly rejects Cashier attempt with 403 Forbidden
    expect(cashierForbiddenRes.error).not.toBeNull();
    expect(cashierForbiddenRes.error).toMatch(/Forbidden: Cashiers are only authorized to transition bookings from scheduled to completed/i);

    // 7. Verify booking status remains 'new' in DB
    const verifyBooking = await getGuestBooking(bookingId, secretToken);
    expect(verifyBooking?.status).toBe("new");
  });
});
