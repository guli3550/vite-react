import { chromium } from "playwright";
import assert from "node:assert/strict";

const baseUrl = (process.env.BASE_URL || "https://gulii.uz").replace(/\/$/, "");
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
});
const pageErrors = [];
const serverErrors = [];

page.on("pageerror", (error) => pageErrors.push(error.message));
page.on("response", (response) => {
  if (response.status() >= 500) {
    serverErrors.push(`${response.status()} ${response.url()}`);
  }
});

try {
  const response = await page.goto(baseUrl, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  assert.ok(response, "Navigation should return an HTTP response");
  assert.ok(response.status() < 400, `Homepage returned HTTP ${response.status()}`);

  await page.locator("#root").waitFor({ state: "attached", timeout: 30000 });
  await page.waitForTimeout(5000);

  const title = await page.title();
  assert.ok(title.trim().length > 0, "Page title should not be empty");

  const rootText = await page.locator("body").innerText();
  assert.ok(rootText.trim().length > 0, "The page should render visible content");

  await page.screenshot({ path: "playwright-smoke.png", fullPage: true });
  assert.deepEqual(pageErrors, [], `Browser runtime errors: ${pageErrors.join("; ")}`);
  assert.deepEqual(serverErrors, [], `HTTP 5xx responses: ${serverErrors.join("; ")}`);

  console.log(JSON.stringify({
    result: "PASS",
    target: baseUrl,
    status: response.status(),
    title,
    viewport: "390x844 mobile",
  }, null, 2));
} finally {
  await browser.close();
}
