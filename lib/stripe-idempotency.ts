import type Stripe from "stripe";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Claim atomique d’un event Stripe (unique sur eventId).
 * Retourne false si déjà traité (retry / duplicate delivery).
 */
export async function claimStripeEvent(event: Stripe.Event): Promise<boolean> {
  try {
    await prisma.stripeProcessedEvent.create({
      data: { eventId: event.id, type: event.type },
    });
    return true;
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return false;
    }
    throw err;
  }
}

/** Libère le claim pour que Stripe puisse retenter après une erreur handler. */
export async function releaseStripeEventClaim(eventId: string): Promise<void> {
  await prisma.stripeProcessedEvent
    .delete({ where: { eventId } })
    .catch(() => undefined);
}
