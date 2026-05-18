// 결재 본문을 클립보드에 HTML + plain text 두 형태로 동시 적재.
//   리치 에디터(G Portal 등) → HTML 인식, 메모장 → plain text fallback.
//   Clipboard API 미지원 환경에서는 plain text 만 적재.

export type CopyResult =
  | { ok: true; mode: "html" | "plain" }
  | { ok: false; error: string };

export async function copyHtmlAndPlain(
  html: string,
  plain: string,
): Promise<CopyResult> {
  // Clipboard API + ClipboardItem 지원 시 두 형태 동시 적재.
  if (
    typeof navigator !== "undefined" &&
    typeof ClipboardItem !== "undefined" &&
    navigator.clipboard?.write
  ) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([plain], { type: "text/plain" }),
        }),
      ]);
      return { ok: true, mode: "html" };
    } catch (e) {
      console.warn("[clipboard] HTML write 실패, plain 으로 fallback", e);
    }
  }

  // Fallback: plain text 만 적재.
  try {
    await navigator.clipboard.writeText(plain);
    return { ok: true, mode: "plain" };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
