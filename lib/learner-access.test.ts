import { describe, expect, it } from "vitest";
import {
  extractDiscordUserIdFromSession,
  extractPriceIdFromSession,
} from "@/lib/learner-access-parse";
import {
  decideGrantOutcome,
  shouldOpenAccessFromCheckout,
  shouldRevokeOnRefund,
  shouldRevokeOnSubscriptionStatus,
} from "@/lib/access-lifecycle-pure";
import {
  expandGuildRoleTargets,
  resolveRoleIdForGuild,
} from "@/lib/guild-grants-pure";
import {
  accessCodePrefix,
  hashAccessCode,
  normalizeAccessCode,
} from "@/lib/access-code-crypto";
import type Stripe from "stripe";

function session(
  partial: Partial<Stripe.Checkout.Session> & {
    metadata?: Record<string, string>;
  }
): Stripe.Checkout.Session {
  return partial as Stripe.Checkout.Session;
}

describe("extractDiscordUserIdFromSession", () => {
  it("lit metadata discord_user_id", () => {
    expect(
      extractDiscordUserIdFromSession(
        session({ metadata: { discord_user_id: "123456789012345678" } })
      )
    ).toBe("123456789012345678");
  });

  it("refuse un id invalide", () => {
    expect(
      extractDiscordUserIdFromSession(
        session({ metadata: { discord_user_id: "not-an-id" } })
      )
    ).toBeNull();
  });
});

describe("extractPriceIdFromSession", () => {
  it("préfère botly_price_id", () => {
    expect(
      extractPriceIdFromSession(
        session({ metadata: { botly_price_id: "price_abc" } })
      )
    ).toBe("price_abc");
  });
});

describe("boucle checkout → accès", () => {
  it("ouvre l’accès seulement si paid ou no_payment_required", () => {
    expect(
      shouldOpenAccessFromCheckout({
        paymentStatus: "paid",
      })
    ).toBe(true);
    expect(
      shouldOpenAccessFromCheckout({
        paymentStatus: "no_payment_required",
      })
    ).toBe(true);
    expect(
      shouldOpenAccessFromCheckout({
        paymentStatus: "unpaid",
      })
    ).toBe(false);
  });

  it("révoque sur unpaid/canceled — pas past_due", () => {
    expect(shouldRevokeOnSubscriptionStatus("unpaid")).toBe(true);
    expect(shouldRevokeOnSubscriptionStatus("canceled")).toBe(true);
    expect(shouldRevokeOnSubscriptionStatus("past_due")).toBe(false);
    expect(shouldRevokeOnSubscriptionStatus("active")).toBe(false);
  });

  it("révoque sur refund si produit configuré", () => {
    expect(
      shouldRevokeOnRefund({ revokeOnRefund: true, refunded: true })
    ).toBe(true);
    expect(
      shouldRevokeOnRefund({ revokeOnRefund: false, refunded: true })
    ).toBe(false);
  });
});

describe("decideGrantOutcome — ACTIVE = tous les grants", () => {
  it("ACTIVE seulement si tous granted", () => {
    expect(decideGrantOutcome(["granted", "granted"]).status).toBe("ACTIVE");
  });

  it("reste AWAITING_JOIN si un serveur manque encore (même si un autre est OK)", () => {
    const outcome = decideGrantOutcome(["granted", "absent"]);
    expect(outcome.status).toBe("AWAITING_JOIN");
    if (outcome.status === "AWAITING_JOIN") {
      expect(outcome.grantedCount).toBe(1);
      expect(outcome.absentCount).toBe(1);
    }
  });

  it("AWAITING_JOIN si tous absents", () => {
    expect(decideGrantOutcome(["absent", "absent"]).status).toBe(
      "AWAITING_JOIN"
    );
  });

  it("blocked si échec dur sans absent", () => {
    expect(decideGrantOutcome(["granted", "failed"]).status).toBe("blocked");
    expect(decideGrantOutcome(["failed"]).status).toBe("blocked");
  });
});

describe("multi-guild grants", () => {
  it("résout le rôle du grant secondaire au join", () => {
    expect(
      resolveRoleIdForGuild({
        joinedGuildId: "g2",
        primaryGuildId: "g1",
        primaryRoleId: "r1",
        grants: [
          { guildId: "g1", discordRoleId: "r1" },
          { guildId: "g2", discordRoleId: "r2" },
        ],
      })
    ).toBe("r2");
  });

  it("fallback rôle primaire si pas de grant", () => {
    expect(
      resolveRoleIdForGuild({
        joinedGuildId: "g1",
        primaryGuildId: "g1",
        primaryRoleId: "r1",
        grants: [],
      })
    ).toBe("r1");
  });

  it("expand utilise le primaire si grants vides", () => {
    expect(
      expandGuildRoleTargets({
        primaryGuildId: "g1",
        primaryRoleId: "r1",
        grants: [],
      })
    ).toEqual([{ guildId: "g1", discordRoleId: "r1" }]);
  });
});

describe("access codes hashed", () => {
  it("normalise et hashe de façon stable", () => {
    const a = hashAccessCode("  abcd12  ");
    const b = hashAccessCode("ABCD12");
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
    expect(normalizeAccessCode(" x ")).toBe("X");
    expect(accessCodePrefix("WXYZ99")).toBe("WXYZ");
  });

  it("génère un code long (32 hex)", async () => {
    const { newAccessCodePlain } = await import("@/lib/access-code-crypto");
    const code = newAccessCodePlain();
    expect(code).toMatch(/^[0-9A-F]{32}$/);
  });
});
