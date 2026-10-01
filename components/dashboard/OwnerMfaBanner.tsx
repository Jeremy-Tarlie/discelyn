import Link from "next/link";
import { getTranslations } from "next-intl/server";

/** Bannière si OWNER sans 2FA — actions billing / secrets bloquées. */
export async function OwnerMfaBanner({
  isOwner,
  mfaEnabled,
}: {
  isOwner: boolean;
  mfaEnabled: boolean;
}) {
  if (!isOwner || mfaEnabled) return null;
  const t = await getTranslations("dashboard");

  return (
    <div className="mb-6 rounded-xl border border-warn/50 bg-warn/10 px-4 py-3 text-sm text-warn">
      <p className="font-medium">{t("ownerMfaTitle")}</p>
      <p className="mt-1 opacity-90">{t("ownerMfaBody")}</p>
      <Link
        href="/dashboard/account"
        className="mt-2 inline-flex font-semibold underline-offset-2 hover:underline"
      >
        {t("ownerMfaCta")}
      </Link>
    </div>
  );
}
