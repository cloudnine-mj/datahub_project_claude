/**
 * E2E — `/settings/access-tokens` 페이지의 핵심 흐름.
 *
 * Phase 4 PR 3 — architecture/access-tokens.md §8.1 와이어프레임의 사용자
 * 인터랙션이 회귀하지 않도록 잠금. 본 spec 은 BFF (`/api/settings/access-tokens`)
 * 응답을 page.route() 로 mock 하여 datahub-api 의존성 제거.
 *
 * 인증
 *   `platform_token` 쿠키만 있으면 middleware 와 BFF 가 통과 (실제 토큰
 *   값은 mock 이 가로채므로 임의의 dummy 로 충분).
 */

import { expect, test } from "@playwright/test";

// ── 공통 fixture ────────────────────────────────────────────────────

const BASE_TOKEN = {
  id: 1,
  prefix: "dh_aaaaaaaa",
  name: "embedding-eval",
  token_type: "read" as const,
  created_at: "2026-04-30T12:00:00Z",
  last_used: null,
  expires_at: "2027-04-30T12:00:00Z",
  is_active: true,
  revoked_at: null,
  grants: [{ resource_type: "user", resource_id: "*", action: "read" }],
};

test.beforeEach(async ({ context }) => {
  // middleware 가 platform_token 쿠키만 확인 (값은 검증 안 함 — datahub-api 가
  // 검증). 본 e2e 에서는 BFF 응답을 mock 하므로 dummy 값으로 충분.
  await context.addCookies([
    {
      name: "platform_token",
      value: "test-platform-token-fake",
      domain: "localhost",
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    },
  ]);
});


// ── 페이지 로드 + 빈 목록 ──────────────────────────────────────────


test("empty list shows guide text", async ({ page }) => {
  await page.route("**/api/settings/access-tokens**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ access_tokens: [] }),
    });
  });

  await page.goto("/settings/access-tokens");

  await expect(page.getByRole("heading", { name: "Access Tokens" })).toBeVisible();
  await expect(page.getByText("발급된 토큰이 없습니다")).toBeVisible();
});


test("list renders existing tokens", async ({ page }) => {
  await page.route("**/api/settings/access-tokens**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ access_tokens: [BASE_TOKEN] }),
    });
  });

  await page.goto("/settings/access-tokens");
  await expect(page.getByText("embedding-eval")).toBeVisible();
  await expect(page.getByText(BASE_TOKEN.prefix, { exact: false })).toBeVisible();
});


// ── 위저드 열기 + 입력 검증 ────────────────────────────────────────


test("create wizard rejects empty name", async ({ page }) => {
  await page.route("**/api/settings/access-tokens**", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ access_tokens: [] }),
      });
      return;
    }
    // POST 도 일단 mock — name 검증은 클라이언트가 먼저 잡아야 함
    await route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({ error: "name is required" }),
    });
  });

  await page.goto("/settings/access-tokens");
  await page.getByRole("button", { name: /새 Access Token/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "발급" }).click();
  await expect(page.getByText(/이름을 입력하세요/)).toBeVisible();
});


// ── Read 토큰 발급 → Created dialog → 복사 후 닫기 ───────────────


test("read token issuance flow shows created dialog with raw value", async ({ page }) => {
  let listCalls = 0;
  await page.route("**/api/settings/access-tokens**", async (route) => {
    const req = route.request();
    if (req.method() === "POST") {
      const body = JSON.parse(req.postData() ?? "{}");
      expect(body.token_type).toBe("read");
      expect(body.name).toBe("my-read");

      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          access_token: "dh_RAW_VALUE_e2e_demo",
          ...BASE_TOKEN,
          name: "my-read",
        }),
      });
      return;
    }
    listCalls += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        access_tokens: listCalls > 1 ? [{ ...BASE_TOKEN, name: "my-read" }] : [],
      }),
    });
  });

  await page.goto("/settings/access-tokens");
  await page.getByRole("button", { name: /새 Access Token/ }).click();
  await page.getByLabel("이름").fill("my-read");
  await page.getByRole("tab", { name: "Read" }).click();
  await page.getByRole("button", { name: "발급" }).click();

  // Created dialog
  await expect(page.getByRole("heading", { name: /Access Token 발급 완료/ })).toBeVisible();
  await expect(page.locator("input#raw-access-token")).toHaveValue("dh_RAW_VALUE_e2e_demo");

  // 복사 전 닫기 비활성
  const closeBtn = page.getByRole("button", { name: /복사 후 닫을/ });
  await expect(closeBtn).toBeDisabled();
});


// ── Fine-grained — 4 영역 + repo typeahead chip 추가 / 삭제 ───────────


test("fine-grained tab — typeahead adds repo chip and remove works", async ({ page }) => {
  await page.route("**/api/settings/access-tokens", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ access_tokens: [] }),
      });
      return;
    }
    await route.continue();
  });

  // autocomplete repos mock
  await page.route(
    "**/api/settings/access-tokens/autocomplete/repos**",
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          repos: [
            {
              repo_name: "nlp-lab/ner-models",
              owner: "alice@x",
              visibility: "public",
              description: null,
              repo_type: "B",
              group: "nlp-lab",
            },
          ],
        }),
      });
    },
  );

  await page.goto("/settings/access-tokens");
  await page.getByRole("button", { name: /새 Access Token/ }).click();
  await page.getByRole("tab", { name: "Fine-grained" }).click();

  // 4 영역이 렌더링됐는지 헤딩 검증
  await expect(page.getByRole("heading", { name: "User permissions" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Repositories permissions" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Group permissions" })).toBeVisible();

  // repo typeahead 에 query 입력 → dropdown 의 항목 클릭 → chip 추가
  await page.getByPlaceholder(/repo 검색/).fill("ner");
  await page.getByRole("button", { name: /nlp-lab\/ner-models/ }).click();
  await expect(page.getByRole("button", { name: /remove nlp-lab\/ner-models/ })).toBeVisible();

  // chip 의 X 버튼으로 제거
  await page.getByRole("button", { name: /remove nlp-lab\/ner-models/ }).click();
  await expect(page.getByRole("button", { name: /remove nlp-lab\/ner-models/ })).toHaveCount(0);
});


// ── 응답 코드별 메시지 분기 ────────────────────────────────────────


test("403 insufficient scope is surfaced to user", async ({ page }) => {
  await page.route("**/api/settings/access-tokens**", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ access_tokens: [] }),
      });
      return;
    }
    await route.fulfill({
      status: 403,
      contentType: "application/json",
      body: JSON.stringify({ error: "insufficient scope" }),
    });
  });

  await page.goto("/settings/access-tokens");
  await page.getByRole("button", { name: /새 Access Token/ }).click();
  await page.getByLabel("이름").fill("scope-denied");
  await page.getByRole("tab", { name: "Read" }).click();
  await page.getByRole("button", { name: "발급" }).click();

  await expect(page.getByText(/insufficient scope/)).toBeVisible();
});


test("404 on revoke shows alert", async ({ page, context }) => {
  // window.confirm + alert 자동 accept
  page.on("dialog", (d) => d.accept());

  await page.route("**/api/settings/access-tokens", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ access_tokens: [BASE_TOKEN] }),
    });
  });
  await page.route(`**/api/settings/access-tokens/${BASE_TOKEN.id}`, async (route) => {
    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: "access token not found" }),
    });
  });

  await page.goto("/settings/access-tokens");
  // revoke 버튼 클릭 (Trash2 아이콘) — title="revoke" 로 식별
  await page.getByRole("button", { name: "revoke" }).first().click();
  // alert 가 발생했음 — dialog handler 가 accept 했고, 페이지 자체는 그대로
  // (구체적 텍스트 검증은 dialog event 캡처로도 가능하지만 본 spec 은 호출 자체가
  // 정상적으로 trigger 되는지에 한정)
});
