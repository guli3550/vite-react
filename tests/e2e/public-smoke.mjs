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
const consoleErrors = [];
const serverErrors = [];
const failedRequests = [];
const suspiciousScripts = [];

page.on("pageerror", (error) => {
  pageErrors.push({ message: error.message, stack: error.stack || "" });
});
page.on("console", (message) => {
  if (message.type() === "error") {
    consoleErrors.push(message.text());
  }
});
page.on("requestfailed", (request) => {
  failedRequests.push({
    url: request.url(),
    error: request.failure()?.errorText || "unknown",
    resourceType: request.resourceType(),
  });
});
page.on("response", async (response) => {
  const request = response.request();
  const url = response.url();
  const status = response.status();
  const contentType = response.headers()["content-type"] || "";
  if (status >= 500) serverErrors.push(`${status} ${url}`);

  if (
    request.resourceType() === "script" &&
    (!contentType.includes("javascript") || status >= 400)
  ) {
    suspiciousScripts.push({ url, status, contentType, resourceType: request.resourceType() });
  }
});

try {
  const response = await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  assert.ok(response, "Navigation should return an HTTP response");
  assert.ok(response.status() < 400, `Homepage returned HTTP ${response.status()}`);

  await page.locator("#root").waitFor({ state: "attached", timeout: 30000 });
  await page.waitForTimeout(7000);

  const title = await page.title();
  assert.ok(title.trim().length > 0, "Page title should not be empty");
  const rootText = await page.locator("body").innerText();
  assert.ok(rootText.trim().length > 0, "The page should render visible content");
  await page.screenshot({ path: "playwright-smoke.png", fullPage: true });

  console.log("Browser diagnostics:", JSON.stringify({
    pageErrors, consoleErrors, suspiciousScripts, failedRequests, serverErrors,
  }, null, 2));

  assert.deepEqual(suspiciousScripts, [], `Scripts returned non-JavaScript or HTTP errors: ${JSON.stringify(suspiciousScripts)}`);
  assert.deepEqual(pageErrors, [], `Browser runtime errors: ${JSON.stringify(pageErrors)}`);
  assert.deepEqual(serverErrors, [], `HTTP 5xx responses: ${serverErrors.join("; ")}`);

  console.log(JSON.stringify({
    result: "PASS", target: baseUrl, status: response.status(), title, viewport: "390x844 mobile",
  }, null, 2));
} finally {
  await browser.close();
}
