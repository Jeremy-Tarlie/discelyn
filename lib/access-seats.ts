import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export {
  isProductSoldOut,
  parseOnboardingSteps,
} from "@/lib/access-seats-pure";

export { newAccessCodePlain } from "@/lib/access-code-crypto";

type DbClient = Prisma.TransactionClient | typeof prisma;

/** Incrémente seatsUsed si place dispo. Retourne false si complet. */
export async function tryReserveSeat(
  productId: string,
  db: DbClient = prisma
): Promise<boolean> {
  const product = await db.accessProduct.findUnique({
    where: { id: productId },
    select: { maxSeats: true, seatsUsed: true },
  });
  if (!product) return false;
  if (product.maxSeats == null) {
    await db.accessProduct.update({
      where: { id: productId },
      data: { seatsUsed: { increment: 1 } },
    });
    return true;
  }
  const updated = await db.accessProduct.updateMany({
    where: {
      id: productId,
      seatsUsed: { lt: product.maxSeats },
    },
    data: { seatsUsed: { increment: 1 } },
  });
  return updated.count > 0;
}

export async function releaseSeat(
  productId: string,
  db: DbClient = prisma
): Promise<void> {
  await db.accessProduct.updateMany({
    where: { id: productId, seatsUsed: { gt: 0 } },
    data: { seatsUsed: { decrement: 1 } },
  });
}
