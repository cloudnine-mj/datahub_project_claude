"use client";

/**
 * Access Token 발급 / rotate 직후 raw access_token 을 1회 노출.
 *
 * architecture/access-tokens.md §11 보안 체크리스트:
 *  - 사용자가 복사 버튼을 누르기 전에는 "닫기" 비활성
 *  - 바깥 클릭 / ESC 로 실수 닫힘 방지 (미복사 시)
 *  - 닫히면 부모가 created=null 로 떨궈 메모리에서 폐기
 *  - autoComplete="new-password" + spellCheck=false (브라우저 자동저장 차단)
 */

import { useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Check, Copy } from "lucide-react";

import type { CreatedAccessToken } from "@/lib/platform-client";

interface Props {
  /** 부모에서 raw access_token 이 살아있는 동안에만 dialog 가 열린다. null 이면 닫힘. */
  created: CreatedAccessToken | null;
  onClose: () => void;
}

export function AccessTokenCreatedDialog({ created, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  // 새 토큰이 들어올 때마다 copied 상태 초기화
  useEffect(() => {
    if (created) setCopied(false);
  }, [created]);

  if (!created) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(created.access_token);
      setCopied(true);
    } catch {
      // 클립보드 미허용 환경 — 수동 복사 유도
      setCopied(true);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (open) return;
    if (!copied) {
      const confirmed = window.confirm(
        "이 토큰은 다시 볼 수 없습니다. 복사하지 않고 닫으시겠습니까?",
      );
      if (!confirmed) return;
    }
    onClose();
  };

  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-lg"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => {
          if (!copied) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Access Token 발급 완료</DialogTitle>
          <DialogDescription>
            아래 토큰을 안전한 곳에 저장하세요. <b>이 화면을 닫으면 다시 볼 수 없습니다.</b>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              raw access_token 은 서버에 저장되지 않습니다. 분실 시 revoke 후 재발급이 필요합니다.
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="raw-access-token">
              Access Token (이름: {created.name} · type: {created.token_type})
            </Label>
            <div className="flex gap-2">
              <Input
                id="raw-access-token"
                readOnly
                value={created.access_token}
                onFocus={(e) => e.currentTarget.select()}
                className="font-mono text-sm"
                autoComplete="new-password"
                spellCheck={false}
              />
              <Button onClick={copy} variant={copied ? "outline" : "default"}>
                {copied ? (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    복사됨
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" />
                    복사
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-text-secondary">
              prefix: <code>{created.prefix}</code>
              {created.expires_at && (
                <> · 만료: {new Date(created.expires_at).toLocaleString()}</>
              )}
            </p>
            {created.grants.length > 0 && (
              <div className="mt-2 rounded-md border bg-gray-50 p-2 text-xs text-text-secondary">
                <div className="mb-1 font-medium text-gray-700">Grants:</div>
                <ul className="space-y-0.5 font-mono">
                  {created.grants.map((g, i) => (
                    <li key={i}>
                      {g.resource_type}:{g.resource_id ?? "*"}:{g.action}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose} disabled={!copied}>
            {copied ? "닫기" : "복사 후 닫을 수 있습니다"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
