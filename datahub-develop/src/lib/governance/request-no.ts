/**
 * 신청 번호 생성 — datahub-web `_next_request_no` 포팅.
 * 포맷: `REQ-YYYY-NNNNN` (연도별 5자리 시퀀스).
 */

import { prisma } from "@/lib/prisma";

export async function nextRequestNo(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `REQ-${year}-`;
  const rows = await prisma.governanceForm.findMany({
    where: { requestNo: { startsWith: prefix } },
    select: { requestNo: true },
  });
  let maxSeq = 0;
  for (const { requestNo } of rows) {
    // '-vN' suffix 제거 (버전 변형)
    const base = requestNo.replace(/-v\d+$/, "");
    const tail = base.split("-").pop();
    const n = tail ? parseInt(tail, 10) : NaN;
    if (Number.isFinite(n) && n > maxSeq) maxSeq = n;
  }
  return `${prefix}${String(maxSeq + 1).padStart(5, "0")}`;
}
