import { prisma } from "@/lib/prisma";
import { getSession, type PlatformSession } from "@/lib/session";

/**
 * platform-api 세션과 Web 전용 Prisma User 테이블을 연결하는 헬퍼.
 *
 * - 로그인은 platform-api `/auth/session` 이 책임진다. Prisma 장애가 로그인을
 *   막지 않는다. 이 함수는 "Web 전용 데이터(플랜/리포트/승인 등)와 사용자 row
 *   를 이어야 하는 라우트"에서만 호출한다.
 * - row 가 없으면 lazy 로 생성(upsert). lab/techCell 매핑은 platform-api 가
 *   채워주는 `labId`/`techCellId` 를 그대로 반영한다.
 */
export async function getDbUser(session?: PlatformSession | null) {
  const s = session ?? (await getSession());
  if (!s) return null;

  const { email, name, image, labId, techCellId } = s.user;

  // role 은 platform-api 의 단일 소스를 그대로 쓰고 Web DB 에는 저장하지 않는다.
  return prisma.user.upsert({
    where: { email },
    update: {
      name: name ?? undefined,
      image: image ?? undefined,
      labId,
      techCellId,
    },
    create: {
      email,
      name: name ?? email.split("@")[0],
      image: image ?? null,
      labId,
      techCellId,
    },
  });
}
