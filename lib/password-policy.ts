import { z } from "zod";

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

export type PasswordRuleId =
  | "minLength"
  | "upper"
  | "lower"
  | "digit"
  | "special";

export type PasswordRuleResult = Record<PasswordRuleId, boolean>;

const PASSWORD_RULE_IDS: readonly PasswordRuleId[] = [
  "minLength",
  "upper",
  "lower",
  "digit",
  "special",
] as const;

/** ASCII classes only: [A-Z], [a-z], [0-9], special = non-alphanumeric. */
export function evaluatePasswordRules(password: string): PasswordRuleResult {
  return {
    minLength: password.length >= PASSWORD_MIN_LENGTH,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    digit: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
}

export function passwordMeetsAllRules(password: string): boolean {
  if (password.length > PASSWORD_MAX_LENGTH) return false;
  const rules = evaluatePasswordRules(password);
  return PASSWORD_RULE_IDS.every((id) => rules[id]);
}


/** Creation / reset — length + complexity. */
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH)
  .max(PASSWORD_MAX_LENGTH)
  .superRefine((value, ctx) => {
    if (!passwordMeetsAllRules(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "weak_password",
      });
    }
  });

/** Login only — no complexity (legacy accounts). */
export const passwordLoginSchema = z
  .string()
  .min(1)
  .max(PASSWORD_MAX_LENGTH);

export function zodErrorIndicatesWeakPassword(error: z.ZodError): boolean {
  return error.issues.some((issue) => issue.message === "weak_password");
}
