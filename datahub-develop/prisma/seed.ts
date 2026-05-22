import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create admin user
  const admin = await prisma.user.upsert({
    where: { email: "admin@lgai.com" },
    update: {},
    create: {
      email: "admin@lgai.com",
      name: "관리자",
    },
  });

  // Create Labs
  const labAI = await prisma.lab.upsert({
    where: { name: "AI Lab" },
    update: {},
    create: {
      name: "AI Lab",
      leaderId: admin.id,
    },
  });

  const labData = await prisma.lab.upsert({
    where: { name: "Data Lab" },
    update: {},
    create: {
      name: "Data Lab",
    },
  });

  // Create users
  const pmUser = await prisma.user.upsert({
    where: { email: "pm@lgai.com" },
    update: {},
    create: {
      email: "pm@lgai.com",
      name: "PM 김철수",
      labId: labAI.id,
    },
  });

  const tmUser = await prisma.user.upsert({
    where: { email: "tm@lgai.com" },
    update: {},
    create: {
      email: "tm@lgai.com",
      name: "TM 이영희",
      labId: labAI.id,
    },
  });

  const normalUser = await prisma.user.upsert({
    where: { email: "user@lgai.com" },
    update: {},
    create: {
      email: "user@lgai.com",
      name: "박연구원",
      labId: labAI.id,
    },
  });

  // Create TechCells
  const tcNLP = await prisma.techCell.upsert({
    where: { id: "tc-nlp" },
    update: {},
    create: {
      id: "tc-nlp",
      name: "NLP TechCell",
      labId: labAI.id,
      leaderId: tmUser.id,
    },
  });

  const tcVision = await prisma.techCell.upsert({
    where: { id: "tc-vision" },
    update: {},
    create: {
      id: "tc-vision",
      name: "Vision TechCell",
      labId: labAI.id,
    },
  });

  // Update users with techCell
  await prisma.user.update({
    where: { id: normalUser.id },
    data: { techCellId: tcNLP.id },
  });

  // Create Projects
  const project1 = await prisma.project.upsert({
    where: { pmsCode: "PJ-2025-001" },
    update: {},
    create: {
      name: "한국어 대화 데이터 구축",
      pmsCode: "PJ-2025-001",
      pmLeaderId: pmUser.id,
      tmLeaderId: tmUser.id,
      budget: 500000000,
      quarter: "2025-Q1",
      status: "ACTIVE",
    },
  });

  const project2 = await prisma.project.upsert({
    where: { pmsCode: "PJ-2025-002" },
    update: {},
    create: {
      name: "멀티모달 학습 데이터",
      pmsCode: "PJ-2025-002",
      pmLeaderId: pmUser.id,
      tmLeaderId: tmUser.id,
      budget: 300000000,
      quarter: "2025-Q1",
      status: "ACTIVE",
    },
  });

  // Create Approval Configs
  await prisma.approvalConfig.upsert({
    where: { type: "PROJECT" },
    update: {},
    create: {
      type: "PROJECT",
      steps: [
        { order: 1, role: "TM_LEADER", resolveFrom: "project" },
        { order: 2, role: "PM_LEADER", resolveFrom: "project" },
      ],
      isActive: true,
    },
  });

  await prisma.approvalConfig.upsert({
    where: { type: "LAB" },
    update: {},
    create: {
      type: "LAB",
      steps: [
        { order: 1, role: "LAB_LEADER", resolveFrom: "lab" },
      ],
      isActive: false,
    },
  });

  await prisma.approvalConfig.upsert({
    where: { type: "TECH_CELL" },
    update: {},
    create: {
      type: "TECH_CELL",
      steps: [
        { order: 1, role: "TECH_CELL_LEADER", resolveFrom: "techCell" },
        { order: 2, role: "LAB_LEADER", resolveFrom: "techCell.lab" },
      ],
      isActive: false,
    },
  });

  await prisma.approvalConfig.upsert({
    where: { type: "PROJECT_TECH_CELL" },
    update: {},
    create: {
      type: "PROJECT_TECH_CELL",
      steps: [
        { order: 1, role: "PM_LEADER", resolveFrom: "project" },
        { order: 2, role: "TM_LEADER", resolveFrom: "techCell.lab" },
      ],
      isActive: false,
    },
  });

  // Create sample Plan
  const plan1 = await prisma.plan.create({
    data: {
      projectId: project1.id,
      authorId: normalUser.id,
      quarter: "2025-Q1",
      dataManagerId: normalUser.id,
      estimatedCost: 50000000,
      purposeType: "DATA_CONSTRUCTION",
      purpose: "한국어 대화 데이터 1만건 구축",
      complianceChecked: true,
      dataName: "Korean Dialogue Dataset v1",
      modality: "Text",
      dataDescription: "일상 대화, 상담, Q&A 등 다양한 도메인의 한국어 대화 데이터",
      qualityManagerId: tmUser.id,
      usageScope: "INTERNAL",
      completionDate: new Date("2025-06-30"),
      reportDueDate: new Date("2025-07-15"),
      status: "DRAFT",
      techCellId: tcNLP.id,
      labId: labAI.id,
    },
  });

  // Budget seed skipped — polymorphic FK constraint issue

  // ─── Governance — sample posts (policy + process) ────────────
  const existingPost = await prisma.governancePost.findFirst();
  if (!existingPost) {
    await prisma.governancePost.createMany({
      data: [
        {
          boardType: "process",
          title: "용역 제작 요청 방법",
          docType: "가이드",
          category: "제작 프로세스",
          content:
            "외주 업체를 통한 데이터 용역 제작 요청 절차입니다.\n\n1. 신청서 작성\n2. 전자결재 상신\n3. 승인 후 외주 매칭 및 작업 착수",
          authorId: admin.id,
          authorName: admin.name ?? "관리자",
        },
        {
          boardType: "process",
          title: "구매 / 구독 요청 방법",
          docType: "가이드",
          category: "제작 프로세스",
          content:
            "외부 데이터셋 구매 또는 구독 신청 절차입니다.\n\n- 일회성 구매 → 데이터 구매 신청\n- 정기 구독 → 데이터 구독 신청",
          authorId: admin.id,
          authorName: admin.name ?? "관리자",
        },
        {
          boardType: "process",
          title: "Product 서비스 로그 데이터 활용 방법",
          docType: "가이드",
          category: "활용 요청 프로세스",
          content:
            "Product 로그 데이터(클릭/세션/이벤트)는 별도 활용 신청을 통해서만 접근 가능합니다.",
          authorId: admin.id,
          authorName: admin.name ?? "관리자",
        },
      ],
    });
  }

  // ─── Governance — sample assignee + form + chat ───────────────
  // Phase 1 고정 담당자. .env 의 GOVERNANCE_ASSIGNEE_EMAIL / _NAME 를 읽어
  // 양방향 채팅 판정과 일치시킴 (env 없으면 fallback 으로 김은솔).
  const assigneeEmail =
    process.env.GOVERNANCE_ASSIGNEE_EMAIL ?? "kim.eunsol@company.com";
  const assigneeName = process.env.GOVERNANCE_ASSIGNEE_NAME ?? "김은솔";

  const assignee = await prisma.user.upsert({
    where: { email: assigneeEmail },
    update: { name: assigneeName },
    create: {
      email: assigneeEmail,
      name: assigneeName,
    },
  });

  // 빈 DB 일 때만 sample form 1건 삽입 (idempotent).
  const existingForm = await prisma.governanceForm.findFirst();
  if (!existingForm) {
    const form = await prisma.governanceForm.create({
      data: {
        requestNo: "REQ-2026-00001",
        formType: "data_purchase",
        projectName: "샘플 데이터 구매 신청",
        submitterId: pmUser.id,
        submitterName: pmUser.name ?? "PM",
        submitterEmail: pmUser.email,
        submitterDepartment: "AI Platform",
        status: "submitted",
        approvalHistory: [
          {
            status: "submitted",
            changedBy: pmUser.name ?? "PM",
            changedAt: new Date().toISOString(),
            comment: "최초 제출",
          },
        ],
        payload: {
          구매_희망_데이터셋: "한국어 음성 코퍼스 라이선스",
          판매_업체: "예시 데이터 컴퍼니",
          사용_예상_금액: "8,000,000원",
          사용_목적_및_기대_효과: "음성 인식 모델 학습 데이터 보강",
        },
      },
    });

    // 데모 채팅 1건 — 신청자 → 담당자
    await prisma.governanceFormMessage.create({
      data: {
        formId: form.id,
        senderId: pmUser.id,
        senderName: pmUser.name ?? "PM",
        senderEmail: pmUser.email,
        senderRole: "applicant",
        recipientName: assignee.name ?? assigneeName,
        recipientRole: "담당자",
        body: "안녕하세요, 검토 부탁드립니다.",
      },
    });
  }

  // ─── 일반 사용자 다수 + 다양한 상태/유형 신청서 샘플 ────────────────
  // 거버넌스 요청 목록 / 관리 페이지 검토용. 모든 신청은 admin 이 아닌 일반 사용자가 제출.
  const sampleUsers = await Promise.all(
    [
      { email: "yujin.park@lgresearch.ai", name: "박유진", department: "AI Platform" },
      { email: "minsu.lee@lgresearch.ai", name: "이민수", department: "Data Science" },
      { email: "soyeon.choi@lgresearch.ai", name: "최소연", department: "Speech AI" },
      { email: "doyun.kim@lgresearch.ai", name: "김도윤", department: "Vision AI" },
      { email: "jaehyun.han@lgresearch.ai", name: "한재현", department: "NLP Team" },
      { email: "hyewon.jung@lgresearch.ai", name: "정혜원", department: "QA Engineering" },
    ].map((u) =>
      prisma.user.upsert({
        where: { email: u.email },
        update: { name: u.name },
        create: { email: u.email, name: u.name },
      }),
    ),
  );

  // 8건 샘플 — requestNo 별 idempotent. 이미 같은 번호가 있으면 skip.
  {
    const now = Date.now();
    const day = (d: number) => new Date(now - d * 24 * 60 * 60 * 1000);

    const samples: Array<{
      requestNo: string;
      formType: string;
      projectName: string;
      submitter: (typeof sampleUsers)[number];
      department: string;
      status: string;
      submittedDaysAgo: number;
      approvedDaysAgo?: number;
      payload: Record<string, unknown>;
    }> = [
      {
        requestNo: "REQ-2026-00002",
        formType: "data_purchase",
        projectName: "고객 행동 분석 데이터셋 구매",
        submitter: sampleUsers[0],
        department: "AI Platform",
        status: "reviewing",
        submittedDaysAgo: 13,
        payload: {
          구매_희망_데이터셋: "국내 e-commerce 클릭 로그 v2",
          판매_업체: "데이터코리아",
          사용_예상_금액: "5,500,000원",
          사용_목적_및_기대_효과: "추천 시스템 개인화 모델 학습",
        },
      },
      {
        requestNo: "REQ-2026-00003",
        formType: "data_subscription",
        projectName: "뉴스 코퍼스 구독",
        submitter: sampleUsers[1],
        department: "Data Science",
        status: "reviewing",
        submittedDaysAgo: 5,
        payload: {
          구독_희망_데이터셋: "한국어 뉴스 기사 월간 피드",
          구독_업체: "프레스데이터",
          구독_기간: "12개월",
          월_사용_예상_금액: "2,200,000원",
          사용_목적: "뉴스 분류 모델 정기 학습 데이터",
        },
      },
      {
        requestNo: "REQ-2026-00004",
        formType: "data_production",
        projectName: "한국어 음성 라벨링 용역",
        submitter: sampleUsers[2],
        department: "Speech AI",
        status: "submitted",
        submittedDaysAgo: 2,
        payload: {
          관련_프로젝트_PMS: "PMS-2026-SPEECH-014",
          데이터셋_활용_목적: "도메인 특화 ASR 모델 학습용 음성 코퍼스",
          데이터셋_이름: "ko-asr-domain-v1",
          희망_작업_착수일: "2026-06-15",
          희망_수령일: "2026-08-31",
          작업_형태: "음성 수집·전사·라벨링",
          목표_데이터_수량: "50,000",
          단위: "발화",
        },
      },
      {
        requestNo: "REQ-2026-00005",
        formType: "data_purchase",
        projectName: "의료 영상 데이터셋 라이선스",
        submitter: sampleUsers[3],
        department: "Vision AI",
        status: "approved",
        submittedDaysAgo: 20,
        approvedDaysAgo: 15,
        payload: {
          구매_희망_데이터셋: "흉부 X-ray 익명화 코퍼스 v3",
          판매_업체: "MedAI Lab",
          사용_예상_금액: "12,000,000원",
          사용_목적_및_기대_효과: "흉부 진단 보조 모델 사전학습",
        },
      },
      {
        requestNo: "REQ-2026-00006",
        formType: "product_log_usage",
        projectName: "Product 로그 활용 — 검색 품질 개선",
        submitter: sampleUsers[4],
        department: "NLP Team",
        status: "submitted",
        submittedDaysAgo: 1,
        payload: {
          서비스명: "Datahub Search",
          활용_목적: "검색 결과 클릭률 기반 랭킹 개선",
          요청_기간: "2026-06 ~ 2026-09",
        },
      },
      {
        requestNo: "REQ-2026-00007",
        formType: "data_subscription",
        projectName: "재무 시계열 데이터 구독",
        submitter: sampleUsers[5],
        department: "QA Engineering",
        status: "info_requested",
        submittedDaysAgo: 4,
        payload: {
          구독_희망_데이터셋: "글로벌 주식 일별 OHLCV",
          구독_업체: "FinDataHub",
          구독_기간: "24개월",
          월_사용_예상_금액: "1,800,000원",
          사용_목적: "이상 거래 패턴 탐지 모델 학습·평가",
        },
      },
      {
        requestNo: "REQ-2026-00008",
        formType: "data_purchase",
        projectName: "지도 POI 데이터셋",
        submitter: sampleUsers[0],
        department: "AI Platform",
        status: "approved",
        submittedDaysAgo: 30,
        approvedDaysAgo: 25,
        payload: {
          구매_희망_데이터셋: "국내 상권 POI 카테고리 데이터",
          판매_업체: "MapKorea",
          사용_예상_금액: "3,400,000원",
          사용_목적_및_기대_효과: "위치 추천 모델 features",
        },
      },
      {
        requestNo: "REQ-2026-00009",
        formType: "data_production",
        projectName: "이미지 캡션 라벨링 용역",
        submitter: sampleUsers[3],
        department: "Vision AI",
        status: "submitted",
        submittedDaysAgo: 4,
        payload: {
          관련_프로젝트_PMS: "PMS-2026-VISION-007",
          데이터셋_활용_목적: "한국어 멀티모달 캡션 학습",
          데이터셋_이름: "ko-image-caption-v2",
          희망_작업_착수일: "2026-07-01",
          희망_수령일: "2026-09-30",
          작업_형태: "한국어 캡션 작성",
          목표_데이터_수량: "100,000",
          단위: "이미지",
        },
      },
    ];

    for (const s of samples) {
      // 같은 requestNo 가 있어도 mock 상태(status/payload/history) 가 변경될 수 있으므로
      // upsert 로 갱신. 사용자 직접 입력한 row 와 충돌 위험은 REQ-2026-0000X 시드 번호
      // 고정 범위이므로 사실상 없음.
      const submittedAt = day(s.submittedDaysAgo);
      const history: { status: string; changedBy: string; changedAt: string; comment: string | null }[] = [
        {
          status: "submitted",
          changedBy: s.submitter.name ?? s.submitter.email,
          changedAt: submittedAt.toISOString(),
          comment: "최초 제출",
        },
      ];
      if (
        s.status === "reviewing" ||
        s.status === "approved" ||
        s.status === "info_requested"
      ) {
        history.push({
          status: "reviewing",
          changedBy: assigneeName,
          changedAt: day(s.submittedDaysAgo - 1).toISOString(),
          comment: "검토 시작",
        });
      }
      if (s.status === "info_requested") {
        // 보완 요청 — FormProcessBar 가 [보완 요청] 접두로 감지하므로 prefix 포함.
        history.push({
          status: "info_requested",
          changedBy: assigneeName,
          changedAt: day(Math.max(s.submittedDaysAgo - 2, 0)).toISOString(),
          comment: "[보완 요청] 사용 목적 상세 보완 부탁드립니다.",
        });
      }
      if (s.status === "approved" && s.approvedDaysAgo !== undefined) {
        history.push({
          status: "approved",
          changedBy: assigneeName,
          changedAt: day(s.approvedDaysAgo).toISOString(),
          comment: "승인 완료",
        });
      }

      await prisma.governanceForm.upsert({
        where: { requestNo: s.requestNo },
        update: {
          formType: s.formType,
          projectName: s.projectName,
          submitterId: s.submitter.id,
          submitterName: s.submitter.name ?? s.submitter.email,
          submitterEmail: s.submitter.email,
          submitterDepartment: s.department,
          status: s.status,
          submittedAt,
          approvalHistory: history as unknown as Prisma.InputJsonValue,
          payload: s.payload as unknown as Prisma.InputJsonValue,
        },
        create: {
          requestNo: s.requestNo,
          formType: s.formType,
          projectName: s.projectName,
          submitterId: s.submitter.id,
          submitterName: s.submitter.name ?? s.submitter.email,
          submitterEmail: s.submitter.email,
          submitterDepartment: s.department,
          status: s.status,
          submittedAt,
          approvalHistory: history as unknown as Prisma.InputJsonValue,
          payload: s.payload as unknown as Prisma.InputJsonValue,
        },
      });
    }
  }

  console.log("Seed completed!");
  console.log("  Admin:    admin@lgai.com");
  console.log("  PM:       pm@lgai.com");
  console.log("  TM:       tm@lgai.com");
  console.log("  User:     user@lgai.com");
  console.log(`  Assignee: ${assigneeEmail} (governance 담당자)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
