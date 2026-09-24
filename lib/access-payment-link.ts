import { prisma } from "@/lib/prisma";
import { getOrgStripeClient } from "@/lib/org-stripe";

/**
 * Active / désactive le Payment Link Stripe selon les sièges restants.
 * Empêche d’encaisser après sold-out (best-effort ; race possible jusqu’au webhook).
 */
export async function syncPaymentLinkAvailability(
  productId: string
): Promise<void> {
  const product = await prisma.accessProduct.findUnique({
    where: { id: productId },
    select: {
      userId: true,
      maxSeats: true,
      seatsUsed: true,
      paymentLinkId: true,
    },
  });
  if (!product?.paymentLinkId || product.maxSeats == null) return;

  const shouldBeActive = product.seatsUsed < product.maxSeats;
  const stripe = await getOrgStripeClient(product.userId);
  if (!stripe) return;

  try {
    await stripe.paymentLinks.update(product.paymentLinkId, {
      active: shouldBeActive,
    });
  } catch (err) {
    console.warn(
      `[access] sync payment link failed product=${productId}`,
      err
    );
  }
}
