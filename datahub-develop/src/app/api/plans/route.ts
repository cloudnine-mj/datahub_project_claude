import { NextRequest, NextResponse } from "next/server";
import { getSession, getPlatformToken } from "@/lib/session";
import { getDbUser } from "@/lib/db-user";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const token = await getPlatformToken();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "10");
    const status = searchParams.get("status");
    const projectId = searchParams.get("projectId");
    const quarter = searchParams.get("quarter");
    const search = searchParams.get("search");

    const where: any = {};

    if (status) {
      where.status = status;
    }
    if (projectId) {
      where.projectId = projectId;
    }
    if (quarter) {
      where.quarter = quarter;
    }
    if (search) {
      where.OR = [
        { dataName: { contains: search, mode: "insensitive" } },
        { purpose: { contains: search, mode: "insensitive" } },
        { dataDescription: { contains: search, mode: "insensitive" } },
      ];
    }

    const [plans, total] = await Promise.all([
      prisma.plan.findMany({
        where,
        include: {
          project: true,
          author: { select: { id: true, name: true, email: true, image: true } },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      prisma.plan.count({ where }),
    ]);

    return NextResponse.json({
      data: plans,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Failed to fetch plans:", error);
    return NextResponse.json(
      { error: "Failed to fetch plans" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbUser = await getDbUser(session);
    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await request.json();
    const userId = dbUser.id;

    // Remove fields that don't exist in the Plan model
    const { year, ...rest } = body;

    // Convert empty strings to null for optional FK/string fields
    const data: any = { ...rest, authorId: userId };
    for (const key of ["dataManagerId", "qualityManagerId", "techCellId", "labId", "period"]) {
      if (data[key] === "" || data[key] === undefined) data[key] = null;
    }

    const plan = await prisma.plan.create({
      data,
      include: {
        project: true,
        author: {
          select: {
            id: true, name: true, email: true, image: true,
            lab: { select: { name: true } },
            techCell: { select: { name: true } },
          },
        },
        qualityManager: { select: { name: true } },
      },
    });

    // 데이터 플랫폼에 LakeFS repo 생성 + UC 메타데이터 초기화
    try {
      const accessToken = session.accessToken;
      // 서버사이드: 클러스터 내부 서비스 주소 우선, 없으면 외부 URL
      const platformUrl =
        process.env.PLATFORM_API_INTERNAL_URL ||
        process.env.NEXT_PUBLIC_PLATFORM_API_URL;
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      };

      console.log("[Plan→Repo] Creating repo:", plan.dataName, "via", platformUrl);

      // 1) 레포 생성
      const repoRes = await fetch(`${platformUrl}/api/v1/repos`, {
        method: "POST",
        headers,
        body: JSON.stringify({ repo_name: plan.dataName }),
      });

      if (!repoRes.ok) {
        const errBody = await repoRes.text().catch(() => "");
        console.error(`[Plan→Repo] POST /repos failed: ${repoRes.status} ${errBody}`);
      } else {
        console.log("[Plan→Repo] Repo created successfully");
      }

      // 2) UC 메타데이터 PATCH (기획서에서 채울 수 있는 필드)
      const tableName = plan.dataName.replace(/-/g, "_");
      const fullName = `datasets.default.${tableName}`;

      const org = [plan.author?.lab?.name, plan.author?.techCell?.name].filter(Boolean).join(" / ");
      const metadata: Record<string, string> = {
        ...(plan.project?.name && { project: plan.project.name }),
        ...(org && { organization: org }),
        ...(plan.author?.name && { owner: plan.author.name }),
        ...(plan.modality && { modality: plan.modality }),
        ...(plan.dataDescription && { dataset_description: plan.dataDescription }),
        license: plan.usageScope === "CONFIDENTIAL" ? "공개 불가"
          : plan.usageScope === "MODEL_SERVICE" ? "모델·서비스 학습"
          : "내부 실험 및 평가",
        version: "1.0",
        updated_at: new Date().toISOString().split("T")[0],
        data_card_tier: "없음",
      };

      const metaRes = await fetch(`${platformUrl}/api/v1/catalog/tables/${fullName}/metadata`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(metadata),
      });

      if (!metaRes.ok) {
        const errBody = await metaRes.text().catch(() => "");
        console.error(`[Plan→Repo] PATCH metadata failed: ${metaRes.status} ${errBody}`);
      } else {
        console.log("[Plan→Repo] Metadata synced successfully");
      }
    } catch (repoError) {
      console.error("[Plan→Repo] Failed to create repo or sync metadata:", repoError);
    }

    return NextResponse.json(plan, { status: 201 });
  } catch (error) {
    console.error("Failed to create plan:", error);
    return NextResponse.json(
      { error: "Failed to create plan" },
      { status: 500 }
    );
  }
}
