import { getTranslations } from "next-intl/server";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { BillingPanels } from "@/components/dashboard/BillingPanels";

type PageProps = {
  searchParams: Promise<{ success?: string }>;
};

export default async function BillingPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  const params = await searchParams;
  const organizationId = session!.user.organizationId;
  if (!organizationId) redirect("/login");

  const t = await getTranslations("dashboard");

  return (
    <div className="mx-auto space-y-8">
      <div>
        <h1 className="font-display text-3xl text-page-fg">
          {t("billingTitle")}
        </h1>
        <p className="mt-2 text-soft">{t("billingIntro")}</p>
      </div>

      <BillingPanels
        organizationId={organizationId}
        success={Boolean(params.success)}
      />
    </div>
  );
}
