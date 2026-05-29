// 최종 협의 내용 다운로드 추상화 — 엑셀(.xlsx) / PDF(.pdf).
//
// UI 컴포넌트는 이 파일의 export 함수만 호출한다. 라이브러리 의존성(SheetJS / jsPDF)을
// 한 파일로 격리해 향후 교체를 쉽게 한다.
//
// - 엑셀: xlsx-js-style (셀 배경색 지원 SheetJS 포크). 시트명 "최종 협의 내용".
// - PDF: jsPDF + html2canvas. 한글 폰트 임베딩 대신 구조화 HTML 을 렌더링해 이미지로 삽입
//        → 별도 폰트 파일 없이 한글 확실히 표시(브라우저 폰트 사용). A4 1페이지.
//        TODO(Phase 2): 선택 가능한 텍스트가 필요하면 한글 서브셋 폰트 임베딩으로 교체.

export interface NegotiationExportData {
  /** 요청 번호 — 표시용(REQ-2026-00016). 파일명에도 사용. */
  requestNo: string;
  datasetName: string;
  /** 신청자 — "이름 (소속)" */
  applicant: string;
  /** 담당자 — 이름. 복수면 콤마 구분. */
  assignee: string;
  /** 발행 시각 — YYYY-MM-DD */
  issuedAt: string;
  selectedVendor: string;
  /** 금액 — 표시 포맷(1,200,000원) 적용된 문자열. */
  amount: string;
  period: string;
  workCount: string;
}

const DASH = "—";
const DIVIDER_LABEL = "— 협의 —";

function dash(v: string): string {
  return v && v.trim().length > 0 ? v : DASH;
}

/** 표 행 구성 — 엑셀/PDF 공통. divider 행은 isDivider=true. */
function buildRows(d: NegotiationExportData): {
  label: string;
  value: string;
  isDivider?: boolean;
}[] {
  return [
    { label: "요청 번호", value: dash(d.requestNo) },
    { label: "데이터셋 이름", value: dash(d.datasetName) },
    { label: "신청자", value: dash(d.applicant) },
    { label: "담당자", value: dash(d.assignee) },
    { label: "발행 시각", value: dash(d.issuedAt) },
    { label: DIVIDER_LABEL, value: "", isDivider: true },
    { label: "선정 업체", value: dash(d.selectedVendor) },
    { label: "금액", value: dash(d.amount) },
    { label: "작업 기간", value: dash(d.period) },
    { label: "작업 건수", value: dash(d.workCount) },
  ];
}

function fileBase(requestNo: string): string {
  const safe = (requestNo || "협의").replace(/[\\/:*?"<>|]/g, "_");
  return `최종협의내용_${safe}`;
}

// ── 엑셀 ──────────────────────────────────────────────────────────────────
export async function exportNegotiationToXlsx(
  d: NegotiationExportData,
): Promise<void> {
  const XLSX = await import("xlsx-js-style");
  const rows = buildRows(d);

  const headerStyle = {
    font: { bold: false, sz: 11 },
    fill: { fgColor: { rgb: "F1F1F1" } },
    alignment: { vertical: "center" as const },
  };
  const dividerStyle = {
    font: { bold: false, sz: 11, color: { rgb: "854F0B" } },
    fill: { fgColor: { rgb: "FCF8EF" } },
    alignment: { vertical: "center" as const },
  };
  const labelStyle = {
    font: { sz: 11, color: { rgb: "555555" } },
    fill: { fgColor: { rgb: "FAFAFA" } },
    alignment: { vertical: "center" as const },
  };
  const valueStyle = {
    font: { sz: 11 },
    alignment: { vertical: "center" as const },
  };

  // aoa: 헤더 + 데이터.
  const aoa: { v: string; t: "s"; s: object }[][] = [];
  aoa.push([
    { v: "항목", t: "s", s: headerStyle },
    { v: "값", t: "s", s: headerStyle },
  ]);
  rows.forEach((r) => {
    if (r.isDivider) {
      aoa.push([
        { v: r.label, t: "s", s: dividerStyle },
        { v: "", t: "s", s: dividerStyle },
      ]);
    } else {
      aoa.push([
        { v: r.label, t: "s", s: labelStyle },
        { v: r.value, t: "s", s: valueStyle },
      ]);
    }
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [{ wch: 18 }, { wch: 40 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "최종 협의 내용");
  XLSX.writeFile(wb, `${fileBase(d.requestNo)}.xlsx`);
}

// ── PDF ───────────────────────────────────────────────────────────────────
function buildPdfHtml(d: NegotiationExportData): HTMLElement {
  const rows = buildRows(d);
  const root = document.createElement("div");
  root.style.cssText =
    "position:fixed;left:-99999px;top:0;width:760px;padding:40px;background:#ffffff;" +
    "font-family:'Pretendard','Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#1f2937;";

  const title = document.createElement("div");
  title.textContent = "최종 협의 내용";
  title.style.cssText = "font-size:22px;font-weight:500;margin-bottom:4px;";
  root.appendChild(title);

  const subtitle = document.createElement("div");
  subtitle.textContent = `${dash(d.requestNo)} · ${dash(d.issuedAt)} 발행`;
  subtitle.style.cssText = "font-size:12px;color:#9ca3af;margin-bottom:22px;";
  root.appendChild(subtitle);

  const table = document.createElement("table");
  table.style.cssText =
    "width:100%;border-collapse:collapse;border:1px solid #e5e7eb;font-size:13px;";
  rows.forEach((r) => {
    const tr = document.createElement("tr");
    if (r.isDivider) {
      const td = document.createElement("td");
      td.colSpan = 2;
      td.textContent = r.label;
      td.style.cssText =
        "background:#FCF8EF;color:#854F0B;padding:9px 12px;border:1px solid #e5e7eb;";
      tr.appendChild(td);
    } else {
      const tdLabel = document.createElement("td");
      tdLabel.textContent = r.label;
      tdLabel.style.cssText =
        "width:160px;background:#fafafa;color:#555;padding:9px 12px;border:1px solid #e5e7eb;";
      const tdValue = document.createElement("td");
      tdValue.textContent = r.value;
      tdValue.style.cssText = "padding:9px 12px;border:1px solid #e5e7eb;";
      tr.appendChild(tdLabel);
      tr.appendChild(tdValue);
    }
    table.appendChild(tr);
  });
  root.appendChild(table);
  return root;
}

export async function exportNegotiationToPdf(
  d: NegotiationExportData,
): Promise<void> {
  const [{ jsPDF }, html2canvasMod] = await Promise.all([
    import("jspdf"),
    import("html2canvas"),
  ]);
  const html2canvas = html2canvasMod.default;

  const el = buildPdfHtml(d);
  document.body.appendChild(el);
  try {
    const canvas = await html2canvas(el, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
    });
    const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 36;
    const imgWidth = pageWidth - margin * 2;
    const imgHeight = (canvas.height / canvas.width) * imgWidth;
    const imgData = canvas.toDataURL("image/png");
    pdf.addImage(imgData, "PNG", margin, margin, imgWidth, imgHeight);
    pdf.save(`${fileBase(d.requestNo)}.pdf`);
  } finally {
    document.body.removeChild(el);
  }
}
