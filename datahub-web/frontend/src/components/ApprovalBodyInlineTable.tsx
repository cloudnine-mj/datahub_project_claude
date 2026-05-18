// 결재 본문 미리보기 — generateApprovalHtml 과 시각적으로 동일한 표.
//   WYSIWYG: 화면 미리보기와 실제 복사 결과가 같은 라이트 톤(흰 배경 + #888 보더 + #F5F5F5
//   라벨 셀)으로 표시. 다크모드에서도 표 자체는 라이트 톤 고정.

import type { ApprovalData } from "@/lib/applicationPreview";

interface Props {
  data: ApprovalData;
}

export function ApprovalBodyInlineTable({ data }: Props) {
  return (
    <div
      style={{
        background: "white",
        border: "0.5px solid #d1d5db",
        borderRadius: 6,
        padding: 16,
      }}
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 12,
          color: "#222",
        }}
      >
        <thead>
          <tr>
            <th
              colSpan={2}
              style={{
                border: "1px solid #888",
                padding: "10px 12px",
                background: "#F5F5F5",
                fontWeight: 700,
                textAlign: "center",
                fontSize: 13,
              }}
            >
              {data.title}
            </th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((r) => (
            <tr key={r.label}>
              <td
                style={{
                  border: "1px solid #888",
                  padding: "8px 12px",
                  background: "#F5F5F5",
                  fontWeight: 500,
                  width: 160,
                }}
              >
                {r.label}
              </td>
              <td
                style={{
                  border: "1px solid #888",
                  padding: "8px 12px",
                }}
              >
                {r.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p
        style={{
          fontSize: 11,
          color: "#666",
          marginTop: 10,
          marginBottom: 0,
        }}
      >
        ※ 본 신청은 Datahub에서 검토를 완료한 사항입니다.
      </p>
    </div>
  );
}
