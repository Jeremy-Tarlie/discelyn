import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { affiliateRefUrl } from "@/lib/learner-access";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ code: string }>;
};

/** Redirect affilié → Payment Link (+ cookie tracking). */
export async function GET(request: NextRequest, context: RouteContext) {
  const { code } = await context.params;
  const productId = request.nextUrl.searchParams.get("product");

  const affiliate = await prisma.affiliate.findFirst({
    where: { code: code.toLowerCase(), active: true },
  });
  if (!affiliate) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  await prisma.affiliateClick.create({
    data: {
      affiliateId: affiliate.id,
      accessProductId: productId,
      meta: { ua: request.headers.get("user-agent")?.slice(0, 200) ?? null },
    },
  });

  let redirectUrl = affiliateRefUrl(affiliate.code);
  if (productId) {
    const product = await prisma.accessProduct.findFirst({
      where: {
        id: productId,
        userId: affiliate.userId,
        active: true,
        paymentLinkUrl: { not: null },
      },
      select: { paymentLinkUrl: true },
    });
    if (product?.paymentLinkUrl) {
      const url = new URL(product.paymentLinkUrl);
      url.searchParams.set("client_reference_id", affiliate.code);
      redirectUrl = url.toString();
    }
  } else {
    const first = await prisma.accessProduct.findFirst({
      where: {
        userId: affiliate.userId,
        active: true,
        paymentLinkUrl: { not: null },
      },
      orderBy: { sortOrder: "asc" },
      select: { paymentLinkUrl: true },
    });
    if (first?.paymentLinkUrl) {
      const url = new URL(first.paymentLinkUrl);
      url.searchParams.set("client_reference_id", affiliate.code);
      redirectUrl = url.toString();
    } else {
      redirectUrl = new URL("/", request.url).toString();
    }
  }

  const response = NextResponse.redirect(redirectUrl);
  response.cookies.set("botly_aff", affiliate.code, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60,
    path: "/",
  });
  return response;
}
