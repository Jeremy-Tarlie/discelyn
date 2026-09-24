import { prisma } from "@/lib/prisma";
import {
  isProductSoldOut,
  parseOnboardingSteps,
} from "@/lib/access-seats-pure";
import { newAccessCodePlain } from "@/lib/access-code-crypto";

export {
  isProductSoldOut,
  parseOnboardingSteps,
} from "@/lib/access-seats-pure";

export { newAccessCodePlain } from "@/lib/access-code-crypto";

/** Incrémente seatsUsed si place dispo. Retourne false si complet. */
export async function tryReserveSeat(productId: string): Promise<boolean> {
  const product = await prisma.accessProduct.findUnique({
    where: { id: productId },
    select: { maxSeats: true, seatsUsed: true },
  });
  if (!product) return false;
  if (product.maxSeats == null) {
    await prisma.accessProduct.update({
      where: { id: productId },
      data: { seatsUsed: { increment: 1 } },
    });
    return true;
  }
  const updated = await prisma.accessProduct.updateMany({
    where: {
      id: productId,
      seatsUsed: { lt: product.maxSeats },
    },
    data: { seatsUsed: { increment: 1 } },
  });
  return updated.count > 0;
}

export async function releaseSeat(productId: string): Promise<void> {
  await prisma.accessProduct.updateMany({
    where: { id: productId, seatsUsed: { gt: 0 } },
    data: { seatsUsed: { decrement: 1 } },
  });
}
