/**
 * 내부 서비스 간 HS256 JWT 발급 — BFF → DIA 호출에 부착하는 X-Service-Token.
 *
 * governance access-token-policy + system-architecture §Component Boundary 정합:
 *   - 사용자 권한 결정은 Authorization Bearer (= 사용자 토큰) 가 담당.
 *   - X-Service-Token 은 caller 식별·rate-limit·audit 라벨링 채널 (권한 결정에 사용 X).
 *
 * Phase 1: HS256 shared secret + 짧은 TTL.
 * Phase 2+ (별도 plan): RS256/EdDSA + JWKS, 또는 Workload Identity 로 진화.
 *
 * 외부 deps 회피: node:crypto 표준 라이브러리만 사용.
 */
import { createHmac, randomBytes } from "node:crypto";

interface JwtClaims {
  sub: string;        // caller 식별자 — "datahub-web"
  scope: "internal";  // DIA verifier 가 검증
  iat: number;
  exp: number;
  jti?: string;
}

function b64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * BFF → DIA 호출용 단기 X-Service-Token 발급.
 * 매 요청마다 새 JWT (jti 포함) 를 발급해 replay 표면 최소화.
 *
 * @param ttlSec 토큰 유효 시간 (초). 기본 300 (5분).
 * @throws secret 미설정 시 throw — caller (BFF route) 에서 500 으로 처리.
 */
export function issueServiceToken(ttlSec = 300): string {
  const secret = process.env.INTERNAL_SERVICE_SECRET_TO_DIA;
  if (!secret || secret.length < 32) {
    throw new Error(
      "INTERNAL_SERVICE_SECRET_TO_DIA is not configured (>=32 chars required)",
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const claims: JwtClaims = {
    sub: "datahub-web",
    scope: "internal",
    iat: now,
    exp: now + ttlSec,
    jti: randomBytes(8).toString("hex"),
  };

  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify(claims));
  const signature = b64url(
    createHmac("sha256", secret).update(`${header}.${payload}`).digest(),
  );
  return `${header}.${payload}.${signature}`;
}
