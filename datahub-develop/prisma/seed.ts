import { PrismaClient } from "@prisma/client";

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

  // ─── Governance — sample assignee + form + chat ───────────────
  // Phase 1 고정 담당자(김은솔). .env 의 GOVERNANCE_ASSIGNEE_EMAIL 와 동일해야
  // 양방향 채팅이 정상 동작.

  const assignee = await prisma.user.upsert({
    where: { email: "kim.eunsol@company.com" },
    update: {},
    create: {
      email: "kim.eunsol@company.com",
      name: "김은솔",
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

    // 데모 채팅 1건 — 신청자 → 담당자(김은솔)
    await prisma.governanceFormMessage.create({
      data: {
        formId: form.id,
        senderId: pmUser.id,
        senderName: pmUser.name ?? "PM",
        senderEmail: pmUser.email,
        senderRole: "applicant",
        recipientName: assignee.name ?? "김은솔",
        recipientRole: "담당자",
        body: "안녕하세요, 검토 부탁드립니다.",
      },
    });
  }

  console.log("Seed completed!");
  console.log("  Admin:    admin@lgai.com");
  console.log("  PM:       pm@lgai.com");
  console.log("  TM:       tm@lgai.com");
  console.log("  User:     user@lgai.com");
  console.log("  Assignee: kim.eunsol@company.com (governance 담당자)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
