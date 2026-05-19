import { prisma } from "./prisma";
import type { ApprovalStepConfig } from "@/types";

/**
 * Resolve the actual approver user ID from a step config and plan context.
 */
async function resolveApprover(
  stepConfig: ApprovalStepConfig,
  planId: string
): Promise<string | null> {
  const plan = await prisma.plan.findUnique({
    where: { id: planId },
    include: {
      project: true,
      techCell: { include: { lab: true } },
      lab: true,
    },
  });
  if (!plan) return null;

  switch (stepConfig.role) {
    case "PM_LEADER":
      return plan.project.pmLeaderId;
    case "TM_LEADER":
      return plan.project.tmLeaderId;
    case "LAB_LEADER":
      if (stepConfig.resolveFrom === "techCell.lab" && plan.techCell) {
        return plan.techCell.lab.leaderId;
      }
      return plan.lab?.leaderId ?? null;
    case "TECH_CELL_LEADER":
      return plan.techCell?.leaderId ?? null;
    default:
      return null;
  }
}

/**
 * Create an approval request for a plan, based on the active approval config.
 */
export async function createApprovalRequest(
  planId: string,
  configType?: string
) {
  // Find active config
  const config = await prisma.approvalConfig.findFirst({
    where: {
      isActive: true,
      ...(configType ? { type: configType as any } : {}),
    },
  });

  if (!config) {
    throw new Error("No active approval configuration found");
  }

  const stepConfigs = config.steps as unknown as ApprovalStepConfig[];

  // Resolve approvers for each step
  const resolvedSteps: { order: number; approverId: string }[] = [];
  for (const step of stepConfigs) {
    const approverId = await resolveApprover(step, planId);
    if (!approverId) {
      throw new Error(
        `Cannot resolve approver for step ${step.order} (role: ${step.role})`
      );
    }
    resolvedSteps.push({ order: step.order, approverId });
  }

  // Create approval request with steps
  const request = await prisma.approvalRequest.create({
    data: {
      planId,
      configId: config.id,
      status: "IN_PROGRESS",
      currentStep: 1,
      steps: {
        create: resolvedSteps.map((s) => ({
          stepOrder: s.order,
          approverId: s.approverId,
          status: "PENDING",
        })),
      },
    },
    include: {
      steps: { include: { approver: true } },
      config: true,
    },
  });

  // Update plan status
  await prisma.plan.update({
    where: { id: planId },
    data: { status: "SUBMITTED" },
  });

  return request;
}

/**
 * Create an approval request for a report.
 */
export async function createReportApprovalRequest(
  reportId: string,
  configType?: string
) {
  const report = await prisma.constructionReport.findUnique({
    where: { id: reportId },
    include: { plan: true },
  });
  if (!report) throw new Error("Report not found");

  const config = await prisma.approvalConfig.findFirst({
    where: {
      isActive: true,
      ...(configType ? { type: configType as any } : {}),
    },
  });
  if (!config) throw new Error("No active approval configuration found");

  const stepConfigs = config.steps as unknown as ApprovalStepConfig[];

  const resolvedSteps: { order: number; approverId: string }[] = [];
  for (const step of stepConfigs) {
    const approverId = await resolveApprover(step, report.planId);
    if (!approverId) {
      throw new Error(
        `Cannot resolve approver for step ${step.order} (role: ${step.role})`
      );
    }
    resolvedSteps.push({ order: step.order, approverId });
  }

  const request = await prisma.approvalRequest.create({
    data: {
      reportId,
      configId: config.id,
      status: "IN_PROGRESS",
      currentStep: 1,
      steps: {
        create: resolvedSteps.map((s) => ({
          stepOrder: s.order,
          approverId: s.approverId,
          status: "PENDING",
        })),
      },
    },
    include: {
      steps: { include: { approver: true } },
      config: true,
    },
  });

  await prisma.constructionReport.update({
    where: { id: reportId },
    data: { status: "SUBMITTED" },
  });

  return request;
}

/**
 * Process an approval step (approve or reject).
 */
export async function processApprovalStep(
  requestId: string,
  approverId: string,
  action: "APPROVED" | "REJECTED",
  comment?: string
) {
  const request = await prisma.approvalRequest.findUnique({
    where: { id: requestId },
    include: {
      steps: { orderBy: { stepOrder: "asc" } },
    },
  });

  if (!request) throw new Error("Approval request not found");

  // Find the current pending step for this approver
  const currentStep = request.steps.find(
    (s) => s.stepOrder === request.currentStep && s.approverId === approverId && s.status === "PENDING"
  );

  if (!currentStep) {
    throw new Error("No pending approval step found for this approver");
  }

  // Update the step
  await prisma.approvalStep.update({
    where: { id: currentStep.id },
    data: {
      status: action,
      comment,
      decidedAt: new Date(),
    },
  });

  if (action === "REJECTED") {
    // Reject the entire request
    await prisma.approvalRequest.update({
      where: { id: requestId },
      data: { status: "REJECTED" },
    });

    // Update plan/report status
    if (request.planId) {
      await prisma.plan.update({
        where: { id: request.planId },
        data: { status: "REJECTED" },
      });
    }
    if (request.reportId) {
      await prisma.constructionReport.update({
        where: { id: request.reportId },
        data: { status: "DRAFT" },
      });
    }
  } else {
    // Check if there are more steps
    const nextStep = request.steps.find(
      (s) => s.stepOrder === request.currentStep + 1
    );

    if (nextStep) {
      // Move to next step
      await prisma.approvalRequest.update({
        where: { id: requestId },
        data: { currentStep: request.currentStep + 1 },
      });
    } else {
      // All steps approved
      await prisma.approvalRequest.update({
        where: { id: requestId },
        data: { status: "APPROVED" },
      });

      if (request.planId) {
        await prisma.plan.update({
          where: { id: request.planId },
          data: { status: "APPROVED" },
        });
      }
      if (request.reportId) {
        await prisma.constructionReport.update({
          where: { id: request.reportId },
          data: { status: "APPROVED" },
        });
      }
    }
  }

  return prisma.approvalRequest.findUnique({
    where: { id: requestId },
    include: {
      steps: { include: { approver: true }, orderBy: { stepOrder: "asc" } },
      config: true,
      plan: true,
      report: true,
    },
  });
}
