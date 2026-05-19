import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config — datahub Web E2E.
 *
 * 본 PR 시점에는 access-tokens 페이지의 핵심 흐름만 cover. 실 dev API 호출은
 * BFF route 를 page.route() 로 mock 하여 환경 의존성을 최소화. 실 dev 환경에
 * 대한 smoke test 는 별도 운영 절차로 분리.
 *
 * 실행:
 *   npx playwright install --with-deps chromium  (최초 1회 — browser 바이너리)
 *   npm run e2e           # CI / headless
 *   npm run e2e:ui        # 로컬 — UI runner
 *
 * 환경변수:
 *   PLAYWRIGHT_BASE_URL=http://localhost:3169   (기본)
 *   CI=true                                      (재시도 / 직렬화)
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3169",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // 로컬 실행 시 Next dev server 자동 기동. CI 는 별도 service.
  webServer: process.env.CI
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3169",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
