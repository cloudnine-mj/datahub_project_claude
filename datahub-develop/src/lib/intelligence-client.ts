/**
 * data-intelligence-api (DIA) 호출 wrapper.
 *
 * 모든 BFF route (`/api/agent/*`, `/api/catalog/ai/*`) 가 본 helper 로 통합되어
 * 호출 헤더·URL·timeout 정책이 한 곳에서 일관 적용된다.
 *
 * 헤더 정책 (governance access-token-policy + intelligence-api-spec):
 *   - `Authorization: Bearer <user-token>`     — DIA 가 datahub-api whoami 위임 검증
 *   - `X-Service-Token: <HS256 JWT, sub=datahub-web>`  — caller 라벨링 (권한 결정 X)
 *
 * URL 우선순위 (governance web-specs §Platform API URL resolution 패턴):
 *   1. INTELLIGENCE_API_INTERNAL_URL  — cluster 내부 service (server-only)
 *   2. http://localhost:8000          — 로컬 dev fallback
 *
 * legacy `AGENT_API_URL` 폴백은 PR 5 cut-off 에서 제거됨.
 */
import { issueServiceToken } from "@/lib/service-token";

function baseUrl(): string {
  return process.env.INTELLIGENCE_API_INTERNAL_URL || "http://localhost:8000";
}

export interface IntelligenceCallOptions {
  /** 사용자 token — getPlatformToken() 결과 */
  userToken: string;
  /** DIA endpoint path. `/query`, `/metadata`, `/datacard` 등 (leading `/`) */
  path: string;
  /** request body — JSON-serialize 됨 */
  body?: unknown;
  /** 요청 timeout (ms). LLM 응답 대비 기본 60s. */
  timeoutMs?: number;
}

export interface IntelligenceResponse {
  status: number;
  ok: boolean;
  /** 응답 본문 — JSON 이면 object, 아니면 raw string */
  data: unknown;
}

export async function callIntelligence({
  userToken,
  path,
  body,
  timeoutMs = 60_000,
}: IntelligenceCallOptions): Promise<IntelligenceResponse> {
  const serviceToken = issueServiceToken();
  const url = `${baseUrl()}${path}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userToken}`,
        "X-Service-Token": serviceToken,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const text = await res.text();
    let data: unknown = text;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        /* keep raw text */
      }
    }
    return { status: res.status, ok: res.ok, data };
  } finally {
    clearTimeout(timer);
  }
}
