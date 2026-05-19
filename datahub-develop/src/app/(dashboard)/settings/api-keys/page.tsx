/**
 * 옛 `/settings/api-keys` → `/settings/access-tokens` 영구 리다이렉트.
 *
 * "API Key" 호칭은 v2 에서 "Access Token" 으로 통일 (architecture/access-tokens.md).
 * 즐겨찾기 / 외부 링크가 깨지지 않도록 본 페이지 자체는 유지하되 access-tokens
 * 으로 자동 이동.
 */

import { redirect } from "next/navigation";

export default function ApiKeysLegacyRedirect(): never {
  redirect("/settings/access-tokens");
}
