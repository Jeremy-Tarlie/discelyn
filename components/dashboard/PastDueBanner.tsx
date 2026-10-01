import Link from "next/link";
import { getTranslations } from "next-intl/server";

/** Bannière si l’abonnement SaaS Discelyn est en retard de paiement. */
export async function PastDueBanner({
  status,
}: {
  status: string;
}) {
  if (status !== "PAST_DUE") return null;
  const t = await getTranslations("dashboard");

  return (
    <div className="mb-6 rounded-xl border border-warn/50 bg-warn/10 px-4 py-3 text-sm text-warn">
      <p className="font-medium">{t("pastDueTitle")}</p>
      <p className="mt-1 opacity-90">{t("pastDueBody")}</p>
      <Link
        href="/dashboard/billing"
        className="mt-2 inline-flex font-semibold underline-offset-2 hover:underline"
      >
        {t("pastDueCta")}
      </Link>
    </div>
  );
}
