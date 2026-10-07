import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Liveness Docker / orchestrateur — DB seulement.
 * Ne ping ni Discord ni le runtime (évite de marquer web unhealthy sur un blip externe).
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      {
        status: "ok",
        service: "discelyn-web",
        db: "ok",
        time: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      {
        status: "error",
        service: "discelyn-web",
        db: "error",
        time: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
