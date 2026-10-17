"use client";

import { useTranslations } from "next-intl";
import {
  evaluatePasswordRules,
  PASSWORD_MIN_LENGTH,
  type PasswordRuleId,
} from "@/lib/password-policy";

const RULE_ORDER: readonly PasswordRuleId[] = [
  "minLength",
  "upper",
  "lower",
  "digit",
  "special",
] as const;

export function PasswordRulesChecklist({
  password,
  id,
}: {
  password: string;
  id?: string;
}) {
  const t = useTranslations("password");
  const rules = evaluatePasswordRules(password);

  const labelFor = (ruleId: PasswordRuleId): string => {
    switch (ruleId) {
      case "minLength":
        return t("ruleMinLength", { n: PASSWORD_MIN_LENGTH });
      case "upper":
        return t("ruleUpper");
      case "lower":
        return t("ruleLower");
      case "digit":
        return t("ruleDigit");
      case "special":
        return t("ruleSpecial");
    }
  };

  return (
    <ul id={id} className="space-y-1 text-xs" aria-label={t("rulesLabel")}>
      {RULE_ORDER.map((ruleId) => {
        const ok = rules[ruleId];
        return (
          <li
            key={ruleId}
            className={
              ok
                ? "text-[color:var(--signal-dim,#2a9e86)] dark:text-signal"
                : "text-[color:var(--muted)]"
            }
          >
            <span className="sr-only">
              {ok ? t("ruleMet") : t("ruleUnmet")}
              {": "}
            </span>
            <span aria-hidden="true">{ok ? "✓" : "○"} </span>
            {labelFor(ruleId)}
          </li>
        );
      })}
    </ul>
  );
}
