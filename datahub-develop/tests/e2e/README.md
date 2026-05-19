# E2E (Playwright)

DataHub Web 의 사용자 흐름을 [Playwright](https://playwright.dev/) 로 잠근다.
본 디렉토리의 spec 들은 BFF (`/api/settings/...`) 응답을 `page.route()` 로
mock 하여 datahub-api 의존성 없이 단독 실행되도록 작성됨. 실 dev 환경에 대한
smoke test 는 별도 운영 절차로 분리.

## 최초 1회 — Browser 바이너리 설치

```bash
npm run e2e:install      # = playwright install --with-deps chromium
```

CI/CD 이미지에는 이미 chromium 설치되어 있다고 가정. 로컬 개발자 머신에서는
위 명령으로 설치.

## 실행

```bash
# CI / headless
npm run e2e

# 로컬 — UI runner (디버깅 친화)
npm run e2e:ui

# 특정 spec 만
npx playwright test tests/e2e/access-tokens.spec.ts

# 실 dev 환경 baseURL 로 실행 (페이지 / BFF 모두 dev 클러스터)
PLAYWRIGHT_BASE_URL=https://dev.datahub.lgair-data.com npm run e2e
```

## 인증 패턴

대부분의 페이지는 `middleware.ts` 의 `platform_token` 쿠키 게이트를 통과해야
한다. spec 의 `test.beforeEach` 에서 dummy `platform_token` 쿠키를 직접 주입하고,
BFF 응답은 `page.route()` 로 mock 한다 — 실제 토큰 검증은 mock 이 가로채므로
값은 임의의 문자열이면 충분.

실 dev 환경 대상 smoke test 는 OAuth login 후 실 cookie 를 storageState
로 보존하는 fixture 가 필요. 본 PR 의 scope 외 (필요 시 별도 PR).

## 스펙 목록

- `access-tokens.spec.ts` — `/settings/access-tokens` 페이지의 7 시나리오:
  - 빈 목록 안내문 / 기존 토큰 목록 렌더
  - 위저드 입력 검증 (이름 필수)
  - Read 토큰 발급 → Created dialog → raw 노출 + 복사 전 닫기 비활성
  - Fine-grained 탭의 grant row 추가 / 삭제
  - 403 `insufficient scope` 응답이 사용자 에러 메시지로 표시
  - 404 응답 시 revoke 흐름의 alert 동작
