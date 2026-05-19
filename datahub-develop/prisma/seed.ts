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

  console.log("Seed completed!");
  console.log("  Admin:  admin@lgai.com");
  console.log("  PM:     pm@lgai.com");
  console.log("  TM:     tm@lgai.com");
  console.log("  User:   user@lgai.com");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
