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
    const planId = searchParams.get("planId");

    const where: any = {};
    if (status) { where.status = status; }
    if (projectId) { where.projectId = projectId; }
    if (planId) { where.planId = planId; }

    const [reports, total] = await Promise.all([
      prisma.constructionReport.findMany({
        where,
        include: {
          plan: true,
          project: true,
          author: { select: { id: true, name: true, email: true, image: true } },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      prisma.constructionReport.count({ where }),
    ]);

    return NextResponse.json({
      data: reports,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    console.error("Failed to fetch reports:", error);
    return NextResponse.json({ error: "Failed to fetch reports" }, { status: 500 });
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

    // Convert empty strings to null for optional FK fields
    const data: any = { ...body, authorId: userId };
    for (const key of ["dataManagerId", "qualityManagerId", "utilizationDate"]) {
      if (data[key] === "" || data[key] === undefined) data[key] = null;
    }

    const report = await prisma.constructionReport.create({
      data,
      include: {
        plan: true,
        project: true,
        author: { select: { id: true, name: true, email: true, image: true } },
      },
    });

    // UC 메타데이터 PATCH — 보고서에서 채울 수 있는 필드
    try {
      const accessToken = session.accessToken;
      const platformUrl = process.env.NEXT_PUBLIC_PLATFORM_API_URL;
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      };

      const tableName = report.dataName.replace(/-/g, "_");
      const fullName = `datasets.default.${tableName}`;

      const metadata: Record<string, string> = {
        ...(report.dataDescription && { dataset_description: report.dataDescription }),
        ...(report.author?.name && { owner: report.author.name }),
        ...(report.dataQuantity && { data_count: String(report.dataQuantity) }),
        ...(report.dataSize && { data_size: report.dataSize }),
        license: report.usageScope === "CONFIDENTIAL" ? "공개 불가"
          : report.usageScope === "MODEL_SERVICE" ? "모델·서비스 학습"
          : "내부 실험 및 평가",
        updated_at: new Date().toISOString().split("T")[0],
      };

      await fetch(`${platformUrl}/api/v1/catalog/tables/${fullName}/metadata`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(metadata),
      });
    } catch (metaError) {
      console.error("Failed to sync report metadata to UC (report still created):", metaError);
    }

    return NextResponse.json(report, { status: 201 });
  } catch (error) {
    console.error("Failed to create report:", error);
    return NextResponse.json({ error: "Failed to create report" }, { status: 500 });
  }
}
