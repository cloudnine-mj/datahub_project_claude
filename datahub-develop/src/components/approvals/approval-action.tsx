"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ApprovalActionProps {
  requestId: string;
  canApprove: boolean;
}

export function ApprovalAction({ requestId, canApprove }: ApprovalActionProps) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAction = async (action: "APPROVED" | "REJECTED") => {
    setLoading(true);
    try {
      const res = await fetch(`/api/approvals/${requestId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, comment }),
      });
      if (res.ok) {
        router.push("/approvals");
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  };

  if (!canApprove) return null;

  return (
    <Card>
      <CardHeader><CardTitle>결재 처리</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          placeholder="코멘트를 입력하세요 (선택)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
        <div className="flex gap-3 justify-end">
          <Button variant="destructive" onClick={() => handleAction("REJECTED")} disabled={loading}>
            반려
          </Button>
          <Button onClick={() => handleAction("APPROVED")} disabled={loading}>
            승인
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
