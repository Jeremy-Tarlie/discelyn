/**
 * Décision multi-guild après tentatives de pose de rôle.
 * Doit rester aligné avec bot-runtime/src/grant-outcome.ts (parity test).
 *
 * Règle produit :
 * - ACTIVE uniquement si **tous** les grants cibles sont posés (membre présent + rôle OK)
 * - AWAITING_JOIN si au moins un serveur manque encore le membre
 * - blocked si échec dur sans progression possible (retry plus tard)
 */

export type GrantAttemptKind = "granted" | "absent" | "failed";

export type GrantOutcome =
  | { status: "ACTIVE"; grantedCount: number }
  | {
      status: "AWAITING_JOIN";
      grantedCount: number;
      absentCount: number;
      needsInvite: true;
    }
  | {
      status: "blocked";
      grantedCount: number;
      absentCount: number;
      failedCount: number;
    };

export function decideGrantOutcome(
  attempts: GrantAttemptKind[]
): GrantOutcome {
  const grantedCount = attempts.filter((a) => a === "granted").length;
  const absentCount = attempts.filter((a) => a === "absent").length;
  const failedCount = attempts.filter((a) => a === "failed").length;

  if (attempts.length === 0) {
    return {
      status: "blocked",
      grantedCount: 0,
      absentCount: 0,
      failedCount: 0,
    };
  }

  if (absentCount > 0) {
    return {
      status: "AWAITING_JOIN",
      grantedCount,
      absentCount,
      needsInvite: true,
    };
  }

  if (grantedCount === attempts.length) {
    return { status: "ACTIVE", grantedCount };
  }

  return {
    status: "blocked",
    grantedCount,
    absentCount,
    failedCount,
  };
}
