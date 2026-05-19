import { NextRequest, NextResponse } from "next/server";
import { getPlatformToken } from "@/lib/session";

export async function GET(_request: NextRequest) {
  try {
    const token = await getPlatformToken();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const roles = [
      { value: "ADMIN", label: "Admin", description: "Full system access" },
      { value: "MANAGER", label: "Manager", description: "Can manage plans, reports, and approvals" },
      { value: "USER", label: "User", description: "Can create and view plans and reports" },
    ];

    return NextResponse.json(roles);
  } catch (error) {
    console.error("Failed to fetch roles:", error);
    return NextResponse.json({ error: "Failed to fetch roles" }, { status: 500 });
  }
}
