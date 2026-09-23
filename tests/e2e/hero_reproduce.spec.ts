import { test, expect } from "@playwright/test";
import fs from "fs";

const BEFORE_DIR = "/tmp/opencode/gate026c/before";
const WIDTHS = [390, 430, 560, 768, 900, 1024, 1280, 1440];

test("capture hero defect before at all breakpoints", async ({ page }) => {
  test.setTimeout(180000);

  if (!fs.existsSync(BEFORE_DIR)) {
    fs.mkdirSync(BEFORE_DIR, { recursive: true });
  }

  const measurements: any[] = [];

  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/", { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
    // Wait for the wheel animation to settle (animation takes ~2.8s)
    await page.waitForTimeout(3500);

    // Capture screenshot of the hero section and full top area
    const heroEl = page.locator(".hero");
    await heroEl.screenshot({ path: `${BEFORE_DIR}/hero-${width}.png` });
    await page.screenshot({ path: `${BEFORE_DIR}/page-${width}.png`, fullPage: false });

    // Measure geometry
    const geom = await page.evaluate(() => {
      const hero = document.querySelector(".hero")?.getBoundingClientRect();
      const content = document.querySelector(".hero-content")?.getBoundingClientRect();
      const headline = document.querySelector(".hero-headline")?.getBoundingClientRect();
      const body = document.querySelector(".hero-body")?.getBoundingClientRect();
      const ctas = document.querySelector(".hero-ctas")?.getBoundingClientRect();
      const trust = document.querySelector(".hero-trust")?.getBoundingClientRect();
      const rig = document.querySelector(".hero-rig")?.getBoundingClientRect();
      const wheel = document.querySelector(".hero-wheel")?.getBoundingClientRect();
      const stage = document.querySelector(".hero-stage")?.getBoundingClientRect();
      const card = document.querySelector(".hero-card")?.getBoundingClientRect();

      const scrollW = document.documentElement.scrollWidth;
      const clientW = document.documentElement.clientWidth;
      const hasOverflow = scrollW > clientW + 1;

      // Overlap detection
      const checkOverlap = (r1: DOMRect | undefined, r2: DOMRect | undefined) => {
        if (!r1 || !r2) return false;
        return !(
          r1.right <= r2.left ||
          r1.left >= r2.right ||
          r1.bottom <= r2.top ||
          r1.top >= r2.bottom
        );
      };

      const overlapsContent = checkOverlap(rig, content);
      const overlapsHeadline = checkOverlap(rig, headline);
      const overlapsBody = checkOverlap(rig, body);
      const overlapsCtas = checkOverlap(rig, ctas);
      const overlapsTrust = checkOverlap(rig, trust);

      return {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        hero: hero ? { width: hero.width, height: hero.height, top: hero.top, bottom: hero.bottom } : null,
        content: content ? { width: content.width, height: content.height, top: content.top, bottom: content.bottom, left: content.left, right: content.right } : null,
        headline: headline ? { width: headline.width, height: headline.height, top: headline.top, bottom: headline.bottom } : null,
        body: body ? { width: body.width, height: body.height, top: body.top, bottom: body.bottom } : null,
        ctas: ctas ? { width: ctas.width, height: ctas.height, top: ctas.top, bottom: ctas.bottom } : null,
        trust: trust ? { width: trust.width, height: trust.height, top: trust.top, bottom: trust.bottom } : null,
        rig: rig ? { width: rig.width, height: rig.height, top: rig.top, bottom: rig.bottom, left: rig.left, right: rig.right } : null,
        wheel: wheel ? { width: wheel.width, height: wheel.height } : null,
        card: card ? { width: card.width, height: card.height, top: card.top, bottom: card.bottom, left: card.left, right: card.right } : null,
        stage: stage ? { width: stage.width, height: stage.height } : null,
        hasOverflow,
        scrollWidth: scrollW,
        clientWidth: clientW,
        overlaps: {
          content: overlapsContent,
          headline: overlapsHeadline,
          body: overlapsBody,
          ctas: overlapsCtas,
          trust: overlapsTrust,
        },
      };
    });

    measurements.push(geom);
  }

  fs.writeFileSync(
    `${BEFORE_DIR}/measurements.json`,
    JSON.stringify(measurements, null, 2)
  );

  console.log("Measurements saved to " + `${BEFORE_DIR}/measurements.json`);
});
