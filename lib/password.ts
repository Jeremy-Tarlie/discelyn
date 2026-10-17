import argon2 from "argon2";

export {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  evaluatePasswordRules,
  passwordLoginSchema,
  passwordMeetsAllRules,
  passwordSchema,
  zodErrorIndicatesWeakPassword,
  type PasswordRuleId,
  type PasswordRuleResult,
} from "@/lib/password-policy";

/** Options argon2id partagées (hash réel + dummy anti-timing). */
export const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
} as const;

/**
 * Hash argon2id constant (plain factice) — coût CPU voisin d’un verify réel
 * pour les early-return login (anti-énumération timing).
 * Produit avec ARGON2_OPTIONS (m=65536,t=3,p=4).
 */
export const DUMMY_PASSWORD_HASH =
  "$argon2id$v=19$m=65536,p=4,t=3$HSTKbhhPPXl9/+WRujKvNQ$udARdvgQ79cNFw6BjyMO1EhorOW1If8Qm34ZIGbAl/Y";

export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, { ...ARGON2_OPTIONS });
}

export async function verifyPassword(
  hash: string,
  plain: string
): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

/** Verify réel, ou verify dummy (toujours false) si hash absent. */
export async function verifyPasswordOrDummy(
  hash: string | null | undefined,
  plain: string
): Promise<boolean> {
  if (hash) return verifyPassword(hash, plain);
  await verifyPassword(DUMMY_PASSWORD_HASH, plain);
  return false;
}
